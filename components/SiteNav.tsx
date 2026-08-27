export function SiteNav() {
  return (
    <header className="nav-term">
      <div className="dex-spectrum" aria-hidden="true" />
      <pre className="nav-term__line">
        <span className="prompt-mark">&gt;</span> commitdex{" "}
        <a href="/#classify">--classify</a> <a href="/wanted">--wanted</a>{" "}
        <a href="/#about">--about</a>
        <span className="caret" aria-hidden="true">
          ▮
        </span>
      </pre>
    </header>
  );
}
