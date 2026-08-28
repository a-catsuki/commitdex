import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export async function SiteNav() {
  const session = await auth();
  const login = session?.login?.trim() || null;

  return (
    <header className="nav-term">
      <div className="dex-spectrum" aria-hidden="true" />
      <nav className="nav-term__line" aria-label="Primary">
        <span className="nav-term__cmds">
          <span className="nav-term__brand" aria-label="Commitdex home">
            <span className="nav-term__brand-mark" aria-hidden="true">
              <span className="prompt-mark">&gt;</span>
            </span>
            <span className="nav-term__brand-name">commitdex</span>
            <span className="nav-term__brand-version">/ v0.1</span>
          </span>
          <Link href="/#classify">--classify</Link>
          <Link href="/wanted">--wanted</Link>
        </span>
        {login ? (
          <span className="nav-term__auth">
            <Link
              className="nav-term__user"
              href={`/t/${encodeURIComponent(login)}`}
            >
              @{login}
            </Link>
            <form
              className="nav-term__auth-form"
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="nav-term__auth-btn">
                --logout
              </button>
            </form>
            <span className="caret" aria-hidden="true">
              ▮
            </span>
          </span>
        ) : (
          <span className="nav-term__auth">
            <form
              className="nav-term__auth-form"
              action={async () => {
                "use server";
                await signIn("github");
              }}
            >
              <button type="submit" className="nav-term__auth-btn">
                --verify-github
              </button>
            </form>
            <span className="caret" aria-hidden="true">
              ▮
            </span>
          </span>
        )}
      </nav>
    </header>
  );
}
