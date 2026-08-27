import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { splitSqlStatements, TRAINER_SCHEMA_SQL } from "./sql";

type D1QueryResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    results?: Record<string, unknown>[];
  }>;
};

type SqliteGlobal = {
  commitdexSqlite?: DatabaseSync;
  commitdexSqlitePath?: string;
};

const CF_API = "https://api.cloudflare.com/client/v4";
const sqliteGlobal = globalThis as typeof globalThis & SqliteGlobal;

export function isRemoteD1Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      d1Token() &&
      process.env.CLOUDFLARE_D1_DATABASE_ID?.trim(),
  );
}

function d1Token(): string | undefined {
  return (
    process.env.CLOUDFLARE_D1_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i += 1) {
    if (existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "d1"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function localSqlitePath(): string {
  if (process.env.COMMITDEX_SQLITE_PATH?.trim()) {
    return path.resolve(process.env.COMMITDEX_SQLITE_PATH.trim());
  }
  return path.resolve(repoRoot(), "data", "commitdex.local.sqlite");
}

export function persistenceMode(): "d1" | "local-sqlite" {
  return isRemoteD1Configured() ? "d1" : "local-sqlite";
}

function requireRemote(): { accountId: string; token: string; databaseId: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = d1Token();
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  if (!accountId || !token || !databaseId) {
    throw new Error(
      "Cloudflare D1 is not configured. Add CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (or CLOUDFLARE_D1_TOKEN), and CLOUDFLARE_D1_DATABASE_ID, or use the local SQLite fallback.",
    );
  }
  return { accountId, token, databaseId };
}

async function d1Http(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const { accountId, token, databaseId } = requireRemote();
  const response = await fetch(
    `${CF_API}/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as D1QueryResponse;
  if (!response.ok || payload.success === false) {
    const detail = payload.errors?.[0]?.message ?? `D1 HTTP ${response.status}`;
    throw new Error(`Could not query D1: ${detail}`);
  }
  const batch = payload.result?.[0];
  if (batch && batch.success === false) {
    throw new Error("Could not query D1: statement failed.");
  }
  return batch?.results ?? [];
}

function openLocal(): DatabaseSync {
  const file = localSqlitePath();
  if (sqliteGlobal.commitdexSqlite && sqliteGlobal.commitdexSqlitePath === file) {
    return sqliteGlobal.commitdexSqlite;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000;");
  sqliteGlobal.commitdexSqlite = db;
  sqliteGlobal.commitdexSqlitePath = file;
  return db;
}

function runLocal(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const db = openLocal();
  const trimmed = sql.trim();
  const stmt = db.prepare(trimmed);
  if (/^\s*select/i.test(trimmed)) {
    return stmt.all(...params);
  }
  stmt.run(...params);
  return [];
}

function ensureLocalSchema(): void {
  const db = openLocal();
  for (const sql of splitSqlStatements(TRAINER_SCHEMA_SQL)) {
    db.exec(sql);
  }
}

async function ensureSchema(): Promise<void> {
  if (isRemoteD1Configured()) {
    for (const sql of splitSqlStatements(TRAINER_SCHEMA_SQL)) {
      await d1Http(sql);
    }
    return;
  }
  ensureLocalSchema();
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const rows = isRemoteD1Configured() ? await d1Http(sql, params) : runLocal(sql, params);
  return rows as T[];
}
