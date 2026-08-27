"use client";

import { useRef, useState } from "react";
import { CardPack } from "@/components/CardPack";
import { CommitPrompt } from "@/components/CommitPrompt";
import { CreatureCard } from "@/components/CreatureCard";
import { PrintBay } from "@/components/PrintBay";
import { downloadCardPng } from "@/lib/download-card";
import {
  PRINT_STAGES,
  RITUAL_MS,
  RITUAL_MS_REDUCED,
  STAGE_MS,
  prefersReducedMotion,
} from "@/lib/ritual";
import { SAMPLE_COMMITS } from "@/lib/type-meta";
import type { CreatureCard as CardData } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "success";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function Workbench() {
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const runRef = useRef(0);

  async function classify(nextMessage = message) {
    const trimmed = nextMessage.trim();
    if (!trimmed) return;

    const run = ++runRef.current;
    const motionOff = prefersReducedMotion();
    const floor = motionOff ? RITUAL_MS_REDUCED : RITUAL_MS;
    const started = performance.now();

    setReduced(motionOff);
    setStatus("loading");
    setError(undefined);
    setCard(null);
    setStageIndex(0);

    const tick = motionOff
      ? undefined
      : window.setInterval(() => {
          setStageIndex((index) => Math.min(index + 1, PRINT_STAGES.length - 1));
        }, STAGE_MS);

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const payload = (await response.json().catch(() => ({}))) as CardData & { error?: string };
      if (!response.ok) {
        if (runRef.current !== run) return;
        setStatus("error");
        setError(
          typeof payload.error === "string" && payload.error
            ? payload.error
            : "The pokedex jammed. Try again in a minute.",
        );
        return;
      }

      const wait = floor - (performance.now() - started);
      if (wait > 0) await sleep(wait);
      if (runRef.current !== run) return;

      setCard(payload);
      setStatus("success");
    } catch {
      if (runRef.current !== run) return;
      setStatus("error");
      setError("The pokedex jammed. Try again in a minute.");
    } finally {
      if (tick) window.clearInterval(tick);
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

  const stage = PRINT_STAGES[Math.min(stageIndex, PRINT_STAGES.length - 1)];

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
            <li key={sample.message}>
              <button
                type="button"
                className="sample"
                data-type={sample.type}
                onClick={() => {
                  setMessage(sample.message);
                  void classify(sample.message);
                }}
                disabled={status === "loading"}
              >
                {sample.message}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bench__tray">
        {status === "loading" ? (
          <PrintBay stage={stage} reduced={reduced} />
        ) : card ? (
          <>
            <CardPack reduced={reduced}>
              <CreatureCard ref={cardRef} card={card} />
            </CardPack>
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
              <p className="bench__note">Roasted by {card.model}.</p>
            </div>
          </>
        ) : (
          <div className="tray-empty" data-state="idle" aria-live="polite">
            <p className="tray-empty__kicker">empty slot</p>
            <p className="tray-empty__title">No specimen yet</p>
            <p>Feed the classifier a commit to lock a card.</p>
          </div>
        )}
      </div>
    </section>
  );
}
