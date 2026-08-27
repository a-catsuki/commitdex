"use client";

import { useRef, useState } from "react";
import { CreatureCard } from "@/components/CreatureCard";
import { DexReel } from "@/components/DexReel";
import { downloadCardPng } from "@/lib/download-card";
import { COPY } from "@/lib/public-error";
import type { CreatureCard as CardData } from "@/lib/types";

type Props = {
  username: string;
  card: CardData;
  canSpin: boolean;
  spinLockedReason: string | null;
  reel: string[];
  photoUrl?: string | null;
};

function profileUrl(username: string): string {
  if (typeof window === "undefined") return `/t/${username}`;
  return `${window.location.origin}/t/${username}`;
}

/** Single eligibility label — never opaque "FOIL LOCKED". */
function pickLockLabel(spinLockedReason: string | null): string {
  if (spinLockedReason === COPY.alreadyPulledToday) return "ALREADY PULLED TODAY";
  if (spinLockedReason === COPY.noNewSpecimens) return "WAITING ON NEW COMMITS";
  return "PICK LOCKED UNTIL TOMORROW";
}

export function DossierDailyPick({
  username,
  card,
  canSpin,
  spinLockedReason,
  reel,
  photoUrl = null,
}: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  function ping(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2200);
  }

  async function download() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      await downloadCardPng(cardRef.current, `${card.name}-${card.type}.png`);
      ping("png burned · check downloads");
    } catch {
      ping("export jammed · try another browser");
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    const url = profileUrl(username);
    const title = `@${username} · Commitdex`;
    const text = `Caught @${username}'s daily foil on Commitdex. Chaos and crimes against git history.`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        ping("dossier beamed");
      } else {
        await navigator.clipboard.writeText(url);
        ping("link copied · dossier packet ready");
      }
    } catch (err) {
      const aborted =
        err instanceof DOMException &&
        (err.name === "AbortError" || err.name === "NotAllowedError");
      if (aborted) {
        // User dismissed share sheet — stay quiet.
      } else {
        try {
          await navigator.clipboard.writeText(url);
          ping("link copied · dossier packet ready");
        } catch {
          ping("share failed · copy the URL bar");
        }
      }
    } finally {
      setSharing(false);
    }
  }

  const actionRow = (
    <div className="dossier-specimen-actions">
      <button
        type="button"
        className="dossier-hud-btn"
        onClick={() => void download()}
        disabled={saving}
        data-state={saving ? "loading" : "idle"}
        aria-label="Download creature card as PNG"
      >
        {saving ? "saving…" : "download"}
      </button>
      <button
        type="button"
        className="dossier-hud-btn"
        onClick={() => void share()}
        disabled={sharing}
        data-state={sharing ? "loading" : "idle"}
        aria-label="Share trainer profile link"
      >
        {sharing ? "sharing…" : "share"}
      </button>
    </div>
  );

  if (canSpin && reel.length > 0) {
    return (
      <div className="dossier__foil dossier__foil--reel">
        <div className="dossier__foil-bar">
          <h2>Daily crank</h2>
          <div className="dossier__foil-tools">{actionRow}</div>
        </div>
        {flash ? (
          <p className="dossier-specimen-flash" role="status" aria-live="polite">
            {flash}
          </p>
        ) : null}
        <DexReel
          username={username}
          reel={reel}
          mode="respin"
          photoUrl={photoUrl}
        />
        <div className="dossier-specimen-export" aria-hidden="true">
          <CreatureCard ref={cardRef} card={card} />
        </div>
      </div>
    );
  }

  return (
    <section className="dossier__foil" aria-label="Allotted specimen">
      <div className="dossier__foil-bar">
        <h2>Allotted specimen</h2>
        <div className="dossier__foil-tools">
          <span className="dossier-status-pill dossier-status-pill--locked">
            {pickLockLabel(spinLockedReason)}
          </span>
          {actionRow}
        </div>
      </div>
      {flash ? (
        <p className="dossier-specimen-flash" role="status" aria-live="polite">
          {flash}
        </p>
      ) : null}
      <div className="dossier__foil-stage">
        <CreatureCard ref={cardRef} card={card} />
      </div>
    </section>
  );
}
