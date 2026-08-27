"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CardPack } from "@/components/CardPack";
import { CreatureCard } from "@/components/CreatureCard";
import { hintReelTicket, reelLabel } from "@/lib/curate";
import { prefersReducedMotion } from "@/lib/ritual";
import { TYPE_META } from "@/lib/type-meta";
import type { CreatureCard as CardData } from "@/lib/types";

const SPIN_MS = 2600;
const RACE_MIN_MS = 480;
const STRIP_LOOPS = 6;
const SETTLE_LOOP = 3;
const FALLBACK_STRIDE = 156;

type Phase = "ready" | "spinning" | "printed" | "error";
type Motion = "rest" | "race" | "settle";

type Props = {
  username: string;
  reel: string[];
  /** When set, reel starts printed on this foil (locked view). */
  lockedCard?: CardData | null;
  /** First allotment vs a new UTC-day re-pull. */
  mode?: "first" | "respin";
  /** Shown under a locked foil instead of a fake crank. */
  lockReason?: string | null;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Park one cycle in so tickets sit on both sides of the pointer at rest. */
function parkOffset(reelItems: string[], lockedMessage?: string | null) {
  if (reelItems.length <= 0) return 0;
  if (lockedMessage) {
    const idx = reelItems.findIndex((m) => m === lockedMessage);
    return reelItems.length + Math.max(0, idx);
  }
  return reelItems.length;
}

export function DexReel({
  username,
  reel,
  lockedCard = null,
  mode = "first",
  lockReason = null,
}: Props) {
  const router = useRouter();
  const stripRef = useRef<HTMLUListElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(lockedCard ? "printed" : "ready");
  const [card, setCard] = useState<CardData | null>(lockedCard);
  const [landed, setLanded] = useState(lockedCard?.original_message ?? reel[0] ?? "");
  const [error, setError] = useState<string | undefined>(lockReason ?? undefined);
  const [reduced, setReduced] = useState(false);
  const [offset, setOffset] = useState(() => parkOffset(reel, lockedCard?.original_message));
  const [motion, setMotion] = useState<Motion>("rest");
  const [stride, setStride] = useState(FALLBACK_STRIDE);
  const [highlight, setHighlight] = useState<number | null>(() => {
    if (!lockedCard) return null;
    const idx = reel.findIndex((m) => m === lockedCard.original_message);
    return idx >= 0 ? reel.length + idx : null;
  });

  const lockedView = Boolean(lockedCard) && phase === "printed";
  const canCrank = !lockedView && phase !== "spinning" && !card;

  const strip = useMemo(() => {
    if (reel.length === 0) return [];
    return Array.from({ length: STRIP_LOOPS }, () => reel).flat();
  }, [reel]);

  const tickets = useMemo(
    () =>
      strip.map((message) => ({
        message,
        ...hintReelTicket(message),
      })),
    [strip],
  );

  useEffect(() => {
    const stripEl = stripRef.current;
    const trackEl = trackRef.current;
    const viewport = viewportRef.current;
    if (!stripEl || !trackEl || !viewport) return;

    const measure = () => {
      const first = stripEl.querySelector<HTMLElement>(".dex-reel__ticket");
      if (!first) return;

      const ticketW = first.getBoundingClientRect().width;
      if (ticketW <= 0) return;

      const gap =
        Number.parseFloat(getComputedStyle(stripEl).columnGap) ||
        Number.parseFloat(getComputedStyle(stripEl).gap) ||
        0;
      const next = ticketW + gap;
      if (next > 0) setStride(next);

      // Pixel lead — % padding on width:max-content resolves against the strip itself.
      const lead = Math.max(0, Math.round(viewport.clientWidth / 2 - ticketW / 2));
      const nextPad = `${lead}px`;
      if (trackEl.style.paddingInline !== nextPad) {
        trackEl.style.paddingInline = nextPad;
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(stripEl);
    return () => ro.disconnect();
  }, [tickets.length]);

  async function crank() {
    if (!canCrank) return;
    const motionOff = prefersReducedMotion();
    setReduced(motionOff);
    setPhase("spinning");
    setError(undefined);
    setHighlight(null);

    const raceFrom = Math.max(reel.length, offset);
    setOffset(raceFrom);
    setMotion(motionOff ? "rest" : "race");

    const start = performance.now();
    try {
      const response = await fetch("/api/trainer/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        card?: CardData;
        landed?: string;
        locked?: boolean;
        spinLockedReason?: string | null;
      };
      if (!response.ok) {
        setMotion("rest");
        setPhase("error");
        setError(
          typeof payload.error === "string" && payload.error
            ? payload.error
            : "The reel jammed. Try again in a minute.",
        );
        return;
      }
      if (payload.locked && payload.spinLockedReason) {
        setMotion("rest");
        setOffset(parkOffset(reel, payload.card?.original_message));
        if (payload.card) {
          setCard(payload.card);
          setLanded(payload.card.original_message);
          setPhase("printed");
        } else {
          setPhase("error");
        }
        setError(payload.spinLockedReason);
        return;
      }
      if (!payload.card || !payload.landed) {
        setMotion("rest");
        setPhase("error");
        setError("The reel jammed. Try again in a minute.");
        return;
      }

      const winnerCard = payload.card;
      const winnerLine = payload.landed;
      const index = reel.findIndex((message) => message === winnerLine);
      const slot = index >= 0 ? index : 0;
      const landIndex = reel.length * SETTLE_LOOP + slot;

      if (motionOff) {
        setOffset(landIndex);
        setLanded(winnerLine);
        setHighlight(landIndex);
        setCard(winnerCard);
        setMotion("rest");
        setPhase("printed");
        return;
      }

      const raced = performance.now() - start;
      if (raced < RACE_MIN_MS) await sleep(RACE_MIN_MS - raced);

      // Clear race animation at the current park, then decelerate to the winner.
      flushSync(() => {
        setMotion("rest");
        setOffset(raceFrom);
      });
      await nextFrame();

      flushSync(() => {
        setMotion("settle");
        setOffset(landIndex);
        setLanded(winnerLine);
        setHighlight(landIndex);
      });

      await sleep(SPIN_MS);
      setCard(winnerCard);
      setMotion("rest");
      setPhase("printed");
    } catch {
      setMotion("rest");
      setPhase("error");
      setError("The reel jammed. Try again in a minute.");
    }
  }

  const busy = phase === "spinning";
  const trackStyle = {
    transform: `translateX(${-offset * stride}px)`,
    transitionDuration: motion === "settle" && !reduced ? `${SPIN_MS}ms` : "0ms",
  };

  return (
    <section className="dex-reel" data-state={phase} aria-label="Specimen reel">
      <header className="dex-reel__head">
        <p className="dex-reel__kicker">dex reel</p>
        <h2 className="dex-reel__title">
          {mode === "respin" ? "Pull a new specimen" : "Allot one specimen"}
        </h2>
        <p className="dex-reel__lede">
          {mode === "respin"
            ? `New UTC day and fresh public commits since last pull. Crank to replace @${username}'s foil on Most Wanted.`
            : `Curated from @${username}'s public log. One pull per UTC day; re-spin needs newer commits.`}
        </p>
      </header>

      <div className="dex-reel__machine">
        <div className="dex-reel__bezel" aria-hidden="true">
          <span>CASE OPEN</span>
          <span>NATL. PULL</span>
        </div>
        <div className="dex-reel__viewport" ref={viewportRef}>
          <div className="dex-reel__pointer" aria-hidden="true">
            <span className="dex-reel__pointer-notch" />
          </div>
          <div className="dex-reel__window">
            <div
              ref={trackRef}
              className="dex-reel__track"
              data-motion={motion === "settle" ? "settle" : "rest"}
              style={trackStyle}
            >
              <ul
                ref={stripRef}
                className="dex-reel__strip"
                data-motion={motion === "race" ? "race" : "rest"}
              >
                {tickets.map((ticket, index) => (
                  <li
                    key={`${ticket.message}-${index}`}
                    className="dex-reel__ticket"
                    data-type={ticket.type}
                    data-rarity={ticket.rarity}
                    data-landed={highlight === index ? "true" : undefined}
                  >
                    <span className="dex-reel__ticket-type">{TYPE_META[ticket.type].label}</span>
                    <code>{reelLabel(ticket.message, 28)}</code>
                    <span className="dex-reel__ticket-rarity" aria-hidden="true">
                      {ticket.rarity === "common" ? "●" : ticket.rarity === "uncommon" ? "◆" : "★"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="dex-reel__landed">
          {phase === "spinning"
            ? motion === "settle"
              ? "locking pull…"
              : "streaming tickets…"
            : landed
              ? reelLabel(landed, 64)
              : "no line locked"}
        </p>
      </div>

      {phase !== "printed" ? (
        <div className="dex-reel__actions">
          <button
            type="button"
            className="btn"
            onClick={() => void crank()}
            disabled={busy || reel.length === 0 || !canCrank}
            aria-busy={busy}
            data-state={busy ? "loading" : error ? "error" : "idle"}
          >
            {busy ? "cranking reel" : mode === "respin" ? "crank for a new pull" : "crank the reel"}
          </button>
          {error ? (
            <p className="prompt__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : card ? (
        <div className="dex-reel__print">
          {lockReason || error ? (
            <p className="dex-reel__lock" role="status">
              {lockReason ?? error}
            </p>
          ) : null}
          <CardPack reduced={reduced}>
            <CreatureCard card={card} />
          </CardPack>
          <button
            type="button"
            className="btn"
            onClick={() => {
              router.push(`/t/${username}`);
              router.refresh();
            }}
          >
            open dossier
          </button>
        </div>
      ) : null}
    </section>
  );
}
