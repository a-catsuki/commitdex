/** Case-insensitive match of verified GitHub login to a trainer handle. */
export function sessionMatchesTrainer(
  login: string | null | undefined,
  githubUsername: string,
): boolean {
  if (!login) return false;
  return login.trim().toLowerCase() === githubUsername.trim().toLowerCase();
}
