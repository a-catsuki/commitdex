"use client";

import { useRef, useState } from "react";
import { CommitPrompt } from "@/components/CommitPrompt";
import { CreatureCard } from "@/components/CreatureCard";
import { downloadCardPng } from "@/lib/download-card";
import { SAMPLE_COMMITS } from "@/lib/type-meta";
import type { CreatureCard as CardData } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "success";

export function Workbench() {
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  async function classify(nextMessage = message) {
    const trimmed = nextMessage.trim();
    if (!trimmed) return;

    setStatus("loading");
    setError(undefined);

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const payload = (await response.json()) as CardData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Classifier returned an error.");
      }
      setCard(payload);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "The classifier did not return a creature. Try again.",
      );
    }
  }

  async function download() {
    if (!cardRef.current || !card) return;
    setSaving(true);
    try {
      await downloadCardPng(cardRef.current, `${card.name}-${card.type}.png`);
    } catch {
      setError("Could not export the card image. Try a different browser.");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bench" id="classify">
      <div className="bench__copy">
        <p className="bench__lede">Paste a commit. Print a creature.</p>
        <CommitPrompt
          value={message}
          onChange={setMessage}
          onSubmit={() => classify()}
          state={status}
          error={error}
        />
        <ul className="samples">
          {SAMPLE_COMMITS.map((sample) => (
            <li key={sample}>
              <button
                type="button"
                className="sample"
                onClick={() => {
                  setMessage(sample);
                  void classify(sample);
                }}
                disabled={status === "loading"}
              >
                {sample}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bench__tray">
        {card ? (
          <>
            <CreatureCard ref={cardRef} card={card} />
            <div className="bench__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void download()}
                disabled={saving}
                data-state={saving ? "loading" : "idle"}
              >
                {saving ? "saving…" : "download png"}
              </button>
              {card.source === "heuristic" ? (
                <p className="bench__note">
                  Classified locally. Set ANTHROPIC_API_KEY for Claude.
                </p>
              ) : (
                <p className="bench__note">Classified by Claude.</p>
              )}
            </div>
          </>
        ) : (
          <div className="tray-empty" aria-live="polite">
            <p>{status === "loading" ? "printing specimen…" : "no specimen yet"}</p>
            <p>Waiting on a commit message.</p>
          </div>
        )}
      </div>
    </section>
  );
}
