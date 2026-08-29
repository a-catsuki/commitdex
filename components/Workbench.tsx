"use client";

import { useRef, useState } from "react";
import { CardPack } from "@/components/CardPack";
import { CommitPrompt } from "@/components/CommitPrompt";
import { CreatureCard } from "@/components/CreatureCard";
import { PrintBay } from "@/components/PrintBay";
import { downloadCardGif, downloadCardPng } from "@/lib/download-card";
import { NAV_TYPE_EVENT, type NavTypeEventDetail } from "@/lib/nav-spectrum";
import {
  PRINT_STAGES,
  RITUAL_MS,
  RITUAL_MS_REDUCED,
  STAGE_MS,
  prefersReducedMotion,
} from "@/lib/ritual";
import { SAMPLE_COMMITS } from "@/lib/type-meta";
import {
  isCreatureCard,
  type CreatureCard as CardData,
  type CreatureType,
} from "@/lib/types";

type Status = "idle" | "loading" | "error" | "success";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function dispatchNavType(type: CreatureType | null) {
  window.dispatchEvent(
    new CustomEvent<NavTypeEventDetail>(NAV_TYPE_EVENT, {
      detail: { type },
    }),
  );
}

export function Workbench() {
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    dispatchNavType(null);
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

      if (!isCreatureCard(payload)) {
        if (runRef.current !== run) return;
        setStatus("error");
        setError("The classifier mumbled. Print again.");
        return;
      }

      const wait = floor - (performance.now() - started);
      if (wait > 0) await sleep(wait);
      if (runRef.current !== run) return;

      setCard(payload);
      dispatchNavType(payload.type);
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
    if (!cardRef.current || !card || exporting) return;
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

  async function exportOpening() {
    if (!cardRef.current || !card || saving || exporting) return;
    setExporting(true);
    try {
      await downloadCardGif(
        cardRef.current,
        `${card.name}-${card.type}`,
        prefersReducedMotion(),
      );
    } catch {
      setError("Could not export the opening. Try a different browser.");
      setStatus("error");
    } finally {
      setExporting(false);
    }
  }

  const stage = PRINT_STAGES[Math.min(stageIndex, PRINT_STAGES.length - 1)];

  return (
    <section className="bench" id="classify">
      <div className="bench__copy">
        <div className="bench__identity" aria-label="Commitdex classifier">
          <span className="bench__identity-mark" aria-hidden="true">CDX</span>
          <span className="bench__identity-copy">
            <span>COMMITDEX</span>
            <span>MESSAGE SPECIMEN LAB</span>
          </span>
          <span className="bench__identity-state">
            <span className="bench__identity-led" aria-hidden="true" />
            ONLINE
          </span>
        </div>
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
                disabled={saving || exporting}
                data-state={saving ? "loading" : "idle"}
              >
                {saving ? "saving…" : "download png"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void exportOpening()}
                disabled={saving || exporting}
                data-state={exporting ? "loading" : "idle"}
                aria-label="Export card opening as animated GIF"
              >
                {exporting ? "encoding…" : "export opening"}
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
