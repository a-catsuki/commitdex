import { Octokit } from "octokit";

export type GitHubCommit = {
  message: string;
  committedAt: string;
  repo: string;
};

export type GitHubUser = {
  login: string;
  id: number;
  avatarUrl: string;
  name: string | null;
};

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

const RATE_LIMIT_MESSAGE = "GitHub is rate-limiting this lookup.";

export function normalizeUsername(raw: string): string | null {
  const cleaned = raw.trim().replace(/^@/, "");
  if (!USERNAME_RE.test(cleaned)) return null;
  return cleaned.toLowerCase();
}

function octokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: "commitdex",
  });
}

function firstLine(message: string): string {
  return message.split(/\r?\n/)[0]?.trim() ?? "";
}

function githubStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

function throwGitHub(error: unknown, notFoundMessage?: string): never {
  const status = githubStatus(error);
  console.error("[commitdex:github]", error);
  if (status === 404 && notFoundMessage) {
    throw new Error(notFoundMessage);
  }
  if (status === 401) {
    throw new Error("GitHub rejected the credentials.");
  }
  if (status === 403 || status === 429) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  const message = error instanceof Error ? error.message : "GitHub lookup failed.";
  if (/rate limit/i.test(message)) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  throw new Error("GitHub lookup failed.");
}

export async function fetchGithubUser(username: string): Promise<GitHubUser> {
  const client = octokit();

  try {
    const { data } = await client.rest.users.getByUsername({ username });
    return {
      login: data.login,
      id: data.id,
      avatarUrl: data.avatar_url,
      name: data.name,
    };
  } catch (error) {
    throwGitHub(error, `GitHub has no public user named ${username}.`);
  }
}

export async function fetchPublicCommits(username: string, limit = 100): Promise<GitHubCommit[]> {
  const client = octokit();

  const fromSearch = await searchCommits(client, username, limit);
  if (fromSearch.length >= 8) return fromSearch.slice(0, limit);

  const fromRepos = await commitsFromRepos(client, username, limit);
  const merged = dedupe([...fromSearch, ...fromRepos]).slice(0, limit);
  if (merged.length === 0) {
    throw new Error(
      "No public commit messages found. The account may have no public repos, or GitHub hid the history.",
    );
  }
  return merged;
}

async function searchCommits(
  client: Octokit,
  username: string,
  limit: number,
): Promise<GitHubCommit[]> {
  try {
    const { data } = await client.rest.search.commits({
      q: `author:${username}`,
      sort: "committer-date",
      order: "desc",
      per_page: Math.min(100, limit),
    });
    return data.items
      .map((item) => ({
        message: firstLine(item.commit.message),
        committedAt: item.commit.committer?.date ?? item.commit.author?.date ?? new Date().toISOString(),
        repo: item.repository.full_name,
      }))
      .filter((row) => row.message.length > 0);
  } catch (error) {
    const status = githubStatus(error);
    if (status === 403 || status === 429 || status === 401) {
      throwGitHub(error);
    }
    return [];
  }
}

async function commitsFromRepos(
  client: Octokit,
  username: string,
  limit: number,
): Promise<GitHubCommit[]> {
  let repos: Awaited<ReturnType<Octokit["rest"]["repos"]["listForUser"]>>["data"];
  try {
    const response = await client.rest.repos.listForUser({
      username,
      type: "owner",
      sort: "pushed",
      per_page: 12,
    });
    repos = response.data;
  } catch (error) {
    throwGitHub(error);
  }

  const out: GitHubCommit[] = [];
  for (const repo of repos) {
    if (out.length >= limit) break;
    if (repo.fork) continue;
    try {
      const { data: commits } = await client.rest.repos.listCommits({
        owner: repo.owner.login,
        repo: repo.name,
        author: username,
        per_page: 30,
      });
      for (const commit of commits) {
        const message = firstLine(commit.commit.message);
        if (!message) continue;
        out.push({
          message,
          committedAt: commit.commit.committer?.date ?? commit.commit.author?.date ?? new Date().toISOString(),
          repo: repo.full_name,
        });
        if (out.length >= limit) break;
      }
    } catch (error) {
      const status = githubStatus(error);
      if (status === 403 || status === 429) throwGitHub(error);
      continue;
    }
  }
  return out;
}

function dedupe(rows: GitHubCommit[]): GitHubCommit[] {
  const seen = new Set<string>();
  const out: GitHubCommit[] = [];
  for (const row of rows) {
    const key = `${row.committedAt}|${row.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
