const STORAGE_KEY = "commitdex-pending-claim";

/** Remember a trainer handle until the matching GitHub login saves it. */
export function setPendingClaim(username: string): void {
  if (typeof window === "undefined") return;
  const handle = username.trim().replace(/^@/, "").toLowerCase();
  if (!handle) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, handle);
  } catch {
    // Private mode or quota — claim resume is best-effort.
  }
}

export function getPendingClaim(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingClaim(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
