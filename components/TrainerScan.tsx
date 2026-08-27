"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TRAINER_STAGES } from "@/lib/ritual";

type Status = "idle" | "loading" | "error" | "success";

export function TrainerScan() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (status !== "loading") return;
    const tick = window.setInterval(() => {
      setStage((index) => (index + 1) % TRAINER_STAGES.length);
    }, 900);
    return () => window.clearInterval(tick);
  }, [status]);

  async function scan() {
    const trimmed = username.trim().replace(/^@/, "");
    if (!trimmed) return;
    setStatus("loading");
    setError(undefined);
    setStage(0);
    try {
      const response = await fetch("/api/trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const payload = (await response.json()) as {
        error?: string;
        trainer?: { github_username: string };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Scan failed.");
      }
      const handle = payload.trainer?.github_username ?? trimmed.toLowerCase();
      setStatus("success");
      router.push(`/t/${handle}`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Scan failed.");
    }
  }

  const busy = status === "loading";
  const empty = username.trim().length === 0;

  return (
    <section className="hunt" id="scan">
      <h2 className="hunt__head">Scan a trainer</h2>
      <p className="hunt__lede">
        Public GitHub username. We read commit messages and timestamps, never the diff.
      </p>
      <form
        className="prompt"
        onSubmit={(event) => {
          event.preventDefault();
          if (!empty && !busy) void scan();
        }}
      >
        <label className="prompt__field" htmlFor="gh-username">
          <span className="prompt__sr">GitHub username</span>
          <span className="prompt__prefix" aria-hidden="true">
            <span className="prompt__dollar">$</span>
            git log --author=&quot;
          </span>
          <input
            id="gh-username"
            className="prompt__input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={39}
            disabled={busy}
            aria-invalid={status === "error"}
            aria-describedby={error ? "hunt-error" : "hunt-help"}
          />
          <span className="prompt__suffix" aria-hidden="true">
            &quot;
          </span>
        </label>
        <div className="prompt__row">
          <p id="hunt-help" className="prompt__help">
            Public repos only. Results land on Most Wanted.
          </p>
          <button
            type="submit"
            className="btn"
            disabled={empty || busy}
            aria-busy={busy}
            data-state={busy ? "loading" : status === "success" ? "success" : "idle"}
          >
            {busy ? TRAINER_STAGES[stage] : "scan history"}
          </button>
        </div>
        {error ? (
          <p id="hunt-error" className="prompt__error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
