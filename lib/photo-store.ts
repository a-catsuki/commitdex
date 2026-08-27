import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isRemoteD1Configured } from "./d1";

export const PHOTO_MAX_BYTES = 300_000;
export const PHOTO_MIME = {
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const;

export type PhotoMime = (typeof PHOTO_MIME)[keyof typeof PHOTO_MIME];

export type StoredPhoto = {
  /** Public path or absolute URL used in <img src>. */
  photo_url: string;
  /** Base64 payload when stored in D1; null for R2 / local file. */
  photo_data: string | null;
  mime: PhotoMime;
  backend: "r2" | "local-file" | "d1-blob";
};

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

function localPhotoDir(): string {
  return path.resolve(repoRoot(), "data", "photos");
}

function localPhotoPath(username: string, mime: PhotoMime): string {
  const ext = mime === PHOTO_MIME.webp ? "webp" : "jpg";
  return path.join(localPhotoDir(), `${username.toLowerCase()}.${ext}`);
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      (process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_R2_TOKEN?.trim()) &&
      process.env.R2_BUCKET?.trim() &&
      process.env.R2_PUBLIC_BASE_URL?.trim(),
  );
}

export function photoBackend(): StoredPhoto["backend"] {
  if (isR2Configured()) return "r2";
  if (!isRemoteD1Configured()) return "local-file";
  return "d1-blob";
}

function r2Token(): string | undefined {
  return (
    process.env.CLOUDFLARE_R2_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

function apiPhotoPath(username: string): string {
  return `/api/trainer/photo/${encodeURIComponent(username.toLowerCase())}`;
}

async function putR2(key: string, bytes: Buffer, mime: PhotoMime): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim();
  const token = r2Token()!;
  const bucket = process.env.R2_BUCKET!.trim();
  const base = process.env.R2_PUBLIC_BASE_URL!.trim().replace(/\/$/, "");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mime,
      },
      body: new Uint8Array(bytes),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[commitdex:r2]", response.status, detail.slice(0, 200));
    throw new Error("Could not store trainer photo.");
  }
  return `${base}/${key}`;
}

async function deleteR2(key: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim();
  const token = r2Token()!;
  const bucket = process.env.R2_BUCKET!.trim();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok && response.status !== 404) {
    console.error("[commitdex:r2]", "delete failed", response.status);
  }
}

function r2Key(username: string, mime: PhotoMime): string {
  const ext = mime === PHOTO_MIME.webp ? "webp" : "jpg";
  return `trainers/${username.toLowerCase()}.${ext}`;
}

export function isAllowedPhotoMime(value: string): value is PhotoMime {
  return value === PHOTO_MIME.jpeg || value === PHOTO_MIME.webp;
}

export async function persistPhotoBytes(
  username: string,
  bytes: Buffer,
  mime: PhotoMime,
): Promise<StoredPhoto> {
  if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new Error("Photo is too large or empty.");
  }

  const handle = username.toLowerCase();
  const backend = photoBackend();

  if (backend === "r2") {
    const url = await putR2(r2Key(handle, mime), bytes, mime);
    return { photo_url: url, photo_data: null, mime, backend };
  }

  if (backend === "local-file") {
    mkdirSync(localPhotoDir(), { recursive: true });
    // Drop any prior extension for this user.
    for (const ext of ["jpg", "webp"] as const) {
      const prior = path.join(localPhotoDir(), `${handle}.${ext}`);
      if (existsSync(prior) && prior !== localPhotoPath(handle, mime)) {
        try {
          unlinkSync(prior);
        } catch {
          /* ignore */
        }
      }
    }
    writeFileSync(localPhotoPath(handle, mime), bytes);
    return { photo_url: apiPhotoPath(handle), photo_data: null, mime, backend };
  }

  return {
    photo_url: apiPhotoPath(handle),
    photo_data: bytes.toString("base64"),
    mime,
    backend: "d1-blob",
  };
}

export async function clearStoredPhotoFiles(
  username: string,
  priorUrl: string | null,
): Promise<void> {
  const handle = username.toLowerCase();
  if (isR2Configured() && priorUrl) {
    for (const mime of [PHOTO_MIME.jpeg, PHOTO_MIME.webp] as const) {
      await deleteR2(r2Key(handle, mime));
    }
  }
  for (const mime of [PHOTO_MIME.jpeg, PHOTO_MIME.webp] as const) {
    const file = localPhotoPath(handle, mime);
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }
}

export function readLocalPhotoFile(
  username: string,
): { bytes: Buffer; mime: PhotoMime } | null {
  const handle = username.toLowerCase();
  for (const mime of [PHOTO_MIME.jpeg, PHOTO_MIME.webp] as const) {
    const file = localPhotoPath(handle, mime);
    if (existsSync(file)) {
      return { bytes: readFileSync(file), mime };
    }
  }
  return null;
}

export function decodePhotoData(
  photoData: string,
  mimeHint?: string | null,
): { bytes: Buffer; mime: PhotoMime } | null {
  const trimmed = photoData.trim();
  if (!trimmed) return null;
  let mime: PhotoMime = PHOTO_MIME.jpeg;
  let b64 = trimmed;
  const dataUrl = /^data:(image\/(?:jpeg|webp));base64,(.+)$/i.exec(trimmed);
  if (dataUrl) {
    mime = dataUrl[1].toLowerCase() as PhotoMime;
    b64 = dataUrl[2];
  } else if (mimeHint && isAllowedPhotoMime(mimeHint)) {
    mime = mimeHint;
  }
  try {
    const bytes = Buffer.from(b64, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) return null;
    return { bytes, mime };
  } catch {
    return null;
  }
}
