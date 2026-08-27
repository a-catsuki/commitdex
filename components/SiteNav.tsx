export function SiteNav() {
  return (
    <header className="nav-term">
      <pre className="nav-term__line">
        <span className="prompt-mark">&gt;</span> commitdex{" "}
        <a href="#classify">--classify</a> <a href="#types">--types</a>{" "}
        <a href="#about">--about</a>
        <span className="caret" aria-hidden="true">
          ▮
        </span>
      </pre>
    </header>
  );
}
