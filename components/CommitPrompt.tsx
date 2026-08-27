"use client";

type PromptState = "idle" | "loading" | "error" | "success";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  state: PromptState;
  error?: string;
};

export function CommitPrompt({ value, onChange, onSubmit, state, error }: Props) {
  const busy = state === "loading";
  const empty = value.trim().length === 0;

  return (
    <form
      className="prompt"
      onSubmit={(event) => {
        event.preventDefault();
        if (!empty && !busy) onSubmit();
      }}
    >
      <label className="prompt__field" htmlFor="commit-message">
        <span className="prompt__sr">Commit message</span>
        <span className="prompt__prefix" aria-hidden="true">
          <span className="prompt__dollar">$</span>
          git commit -m &quot;
        </span>
        <input
          id="commit-message"
          className="prompt__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={500}
          disabled={busy}
          aria-invalid={state === "error"}
          aria-describedby={error ? "prompt-error" : "prompt-help"}
          aria-required
        />
        <span className="prompt__suffix" aria-hidden="true">
          &quot;
        </span>
      </label>

      <div className="prompt__row">
        <p id="prompt-help" className="prompt__help">
          One message. Enter to print.
        </p>
        <button
          type="submit"
          className="btn"
          disabled={empty || busy}
          aria-busy={busy}
          data-state={busy ? "loading" : state === "success" ? "success" : "idle"}
        >
          {busy ? "printing…" : "print card"}
        </button>
      </div>

      {error ? (
        <p id="prompt-error" className="prompt__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
