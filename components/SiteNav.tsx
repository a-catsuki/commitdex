export function SiteNav() {
  return (
    <header className="nav-term">
      <div className="dex-spectrum" aria-hidden="true" />
      <pre className="nav-term__line">
        <span className="nav-term__brand">
          <span className="prompt-mark">&gt;</span> commitdex
        </span>
        <a href="/#classify">--classify</a>
        <a href="/wanted">--wanted</a>
        <span className="caret" aria-hidden="true">
          ▮
        </span>
      </pre>
    </header>
  );
}
