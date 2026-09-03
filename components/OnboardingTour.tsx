"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ONBOARDING_STORAGE_KEY,
  getTourSafeMargins,
  isInStickyTourNav,
  readOnboardingStatus,
  scrollTourTargetIntoView,
  setTourScrollLock,
  tourSleep,
  waitForBootDismissed,
  waitForNextPaint,
  waitForScrollSettled,
  waitForTourTarget,
  writeOnboardingStatus,
} from "@/lib/onboarding";
import { prefersReducedMotion } from "@/lib/ritual";

const BOOT_SETTLE_MS = 320;
const SPOTLIGHT_PAD = 12;
const CARD_GAP = 20;
const ARROW_SIZE = 10;
const ARROW_CLAMP = 32;

type Placement = "top" | "bottom" | "left" | "right";

type TourStep = {
  kicker: string;
  title: string;
  body: string;
  callout?: string;
  target?: string;
  route?: string;
  hash?: string;
  placement?: Placement | "auto";
  critical?: boolean;
};

const STEPS: TourStep[] = [
  {
    kicker: "commitdex · field guide",
    title: "Welcome, trainer",
    body:
      "We read commit messages and timestamps — never the diff — then print collectible creature cards. Roast one message, or scan a whole GitHub history.",
  },
  {
    kicker: "01 · classify",
    title: "Roast a single commit",
    body:
      "Drop any commit message into --classify, hit enter, and wait for your card. Sample commits ship pre-loaded if you want a dry run.",
    callout: "paste → enter → card prints",
    target: "classify",
    route: "/",
    hash: "classify",
    placement: "bottom",
  },
  {
    kicker: "02 · trainer scan",
    title: "Scan a GitHub handle",
    body:
      "Enter a public username below. We cluster commits into a trainer dossier and preview your chaos score — free, but it won't stick until you claim.",
    callout: "public repos only · preview is free",
    target: "scan",
    route: "/",
    hash: "scan",
    placement: "top",
  },
  {
    kicker: "03 · claim",
    title: "Verify GitHub to save",
    body:
      "Preview scans don't stick. Hit --verify-github in the nav, sign in with the same account you scanned, then scan again to claim your trainer on Most Wanted.",
    callout: "same GitHub account · or it stays a ghost preview",
    target: "verify-github",
    placement: "bottom",
    critical: true,
  },
  {
    kicker: "04 · bounties",
    title: "Most Wanted & daily pick",
    body:
      "Claimed trainers land on the leaderboard (--bounties). Spin the reel for a featured card and unlock daily pick plus the photobooth.",
    callout: "leaderboard → reel → dossier perks",
    target: "bounties",
    route: "/wanted",
    placement: "bottom",
  },
];

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(event: ReactKeyboardEvent<HTMLElement>, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;

  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => !node.hasAttribute("disabled") && node.offsetParent !== null,
  );
  if (nodes.length === 0) return;

  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (active === last || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

function pickPlacement(
  rect: DOMRect,
  cardW: number,
  cardH: number,
  prefer: Placement | "auto",
): Placement {
  const margins = getTourSafeMargins();
  const gap = CARD_GAP + ARROW_SIZE;
  const spaces: Record<Placement, number> = {
    top: rect.top - margins.top,
    bottom: window.innerHeight - rect.bottom - margins.bottom,
    left: rect.left - margins.side,
    right: window.innerWidth - rect.right - margins.side,
  };

  if (prefer !== "auto") {
    const need = prefer === "left" || prefer === "right" ? cardW + gap : cardH + gap;
    if (spaces[prefer] >= need) return prefer;
  }

  const ranked: Placement[] = ["bottom", "top", "right", "left"];
  for (const side of ranked) {
    const need = side === "left" || side === "right" ? cardW + gap : cardH + gap;
    if (spaces[side] >= need) return side;
  }

  return prefer === "auto" ? "bottom" : prefer;
}

function positionCard(
  rect: DOMRect,
  placement: Placement,
  cardW: number,
  cardH: number,
) {
  const margins = getTourSafeMargins();
  const gap = CARD_GAP + ARROW_SIZE;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - cardW / 2;
      break;
    case "top":
      top = rect.top - gap - cardH;
      left = rect.left + rect.width / 2 - cardW / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.right + gap;
      break;
    case "left":
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.left - gap - cardW;
      break;
  }

  left = Math.max(margins.side, Math.min(left, window.innerWidth - cardW - margins.side));
  top = Math.max(margins.top, Math.min(top, window.innerHeight - cardH - margins.bottom));

  const targetCenterX = rect.left + rect.width / 2;
  const targetCenterY = rect.top + rect.height / 2;
  const arrowOffset =
    placement === "top" || placement === "bottom"
      ? Math.min(Math.max(targetCenterX - left, ARROW_CLAMP), cardW - ARROW_CLAMP)
      : Math.min(Math.max(targetCenterY - top, ARROW_CLAMP), cardH - ARROW_CLAMP);

  return { top, left, placement, arrowOffset };
}

type Props = {
  manual?: boolean;
  onClose?: () => void;
};

export function OnboardingTour({ manual = false, onClose }: Props) {
  const titleId = useId();
  const bodyId = useId();
  const liveId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const cardRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const spotRectRef = useRef<DOMRect | null>(null);
  const prepareTokenRef = useRef(0);

  const [open, setOpen] = useState(manual);
  const [stepIndex, setStepIndex] = useState(0);
  const [reduced] = useState(() =>
    typeof window !== "undefined" ? prefersReducedMotion() : false,
  );
  const [preparing, setPreparing] = useState(false);
  const [preparingLabel, setPreparingLabel] = useState("loading…");
  const [spotRect, setSpotRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{
    top: number;
    left: number;
    placement: Placement;
    arrowOffset: number;
  } | null>(null);

  useLayoutEffect(() => {
    spotRectRef.current = spotRect;
  }, [spotRect]);

  const dismiss = useCallback(
    (status: "done" | "skipped") => {
      writeOnboardingStatus(status);
      setOpen(false);
      targetElRef.current = null;
      setSpotRect(null);
      setCardPos(null);
      setTourScrollLock(false);
      onClose?.();
    },
    [onClose],
  );

  const measureCard = useCallback(
    (rectOverride?: DOMRect | null) => {
      if (preparing) return;

      const step = STEPS[stepIndex];
      const card = cardRef.current;
      if (!card) return;

      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      const margins = getTourSafeMargins();

      if (!step.target) {
        setCardPos({
          top: Math.max(margins.top, (window.innerHeight - cardH) / 2),
          left: Math.max(margins.side, (window.innerWidth - cardW) / 2),
          placement: "bottom",
          arrowOffset: cardW / 2,
        });
        return;
      }

      const targetRect = rectOverride ?? spotRectRef.current;
      if (!targetRect) return;

      setCardPos(
        positionCard(
          targetRect,
          pickPlacement(targetRect, cardW, cardH, step.placement ?? "auto"),
          cardW,
          cardH,
        ),
      );
    },
    [preparing, stepIndex],
  );

  const syncSpotAndCard = useCallback(() => {
    const el = targetElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpotRect(rect);
    measureCard(rect);
  }, [measureCard]);

  useEffect(() => {
    if (manual) return;
    if (readOnboardingStatus()) return;

    let cancelled = false;

    void (async () => {
      await waitForBootDismissed();
      if (cancelled) return;
      await tourSleep(BOOT_SETTLE_MS);
      if (cancelled || readOnboardingStatus()) return;
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [manual]);

  useEffect(() => {
    if (!open) return;

    const token = prepareTokenRef.current + 1;
    prepareTokenRef.current = token;
    let cancelled = false;
    const isStale = () => cancelled || prepareTokenRef.current !== token;

    async function prepareStep() {
      const step = STEPS[stepIndex];
      setPreparing(true);
      setPreparingLabel("loading…");
      setCardPos(null);
      targetElRef.current = null;

      if (!step.target) {
        setSpotRect(null);
      }

      if (step.route && pathname !== step.route) {
        setPreparingLabel("routing…");
        router.push(`${step.route}${step.hash ? `#${step.hash}` : ""}`);
        setPreparing(false);
        return;
      }

      if (step.hash && typeof window !== "undefined") {
        const hash = `#${step.hash}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", `${pathname}${hash}`);
        }
      }

      await waitForNextPaint();
      if (isStale()) return;

      let target: HTMLElement | null = null;
      if (step.target) {
        setPreparingLabel("locating…");
        target = await waitForTourTarget(`[data-tour="${step.target}"]`, isStale);
      }

      if (isStale()) return;

      if (step.target && !target) {
        setPreparing(false);
        return;
      }

      if (target) {
        if (!isInStickyTourNav(target)) {
          setPreparingLabel("scrolling…");
          scrollTourTargetIntoView(target, reduced);
          await waitForScrollSettled(reduced);
        } else if (!reduced) {
          await tourSleep(120);
        }

        if (isStale()) return;

        await waitForNextPaint();
        if (isStale()) return;

        targetElRef.current = target;
      }

      setPreparing(false);
    }

    void prepareStep();

    return () => {
      cancelled = true;
    };
  }, [open, pathname, reduced, router, stepIndex]);

  useLayoutEffect(() => {
    if (!open) {
      setTourScrollLock(false);
      return;
    }

    setTourScrollLock(!preparing);

    if (preparing) return;

    const step = STEPS[stepIndex];
    if (step.target) {
      syncSpotAndCard();
      return;
    }

    measureCard();
  }, [measureCard, open, preparing, stepIndex, syncSpotAndCard]);

  useEffect(() => {
    if (!open || preparing) return;

    let raf = 0;

    function refreshSpot() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (preparing) return;
        syncSpotAndCard();
      });
    }

    window.addEventListener("scroll", refreshSpot, { capture: true, passive: true });
    window.addEventListener("resize", refreshSpot, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", refreshSpot, true);
      window.removeEventListener("resize", refreshSpot);
    };
  }, [open, preparing, stepIndex, syncSpotAndCard]);

  useEffect(() => {
    if (!open || preparing) return;
    const card = cardRef.current;
    if (!card) return;

    const observer = new ResizeObserver(() => {
      measureCard();
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [measureCard, open, preparing, stepIndex]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss("skipped");
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [dismiss, open]);

  useEffect(() => {
    if (!open) {
      setTourScrollLock(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || preparing) return;
    nextRef.current?.focus({ preventScroll: true });
  }, [open, preparing, stepIndex]);

  if (!open) return null;

  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;
  const welcome = stepIndex === 0;
  const centered = !step.target || welcome;
  const showSpotlight = Boolean(spotRect && step.target);
  const spotlightStyle = spotRect
    ? {
        top: spotRect.top - SPOTLIGHT_PAD,
        left: spotRect.left - SPOTLIGHT_PAD,
        width: spotRect.width + SPOTLIGHT_PAD * 2,
        height: spotRect.height + SPOTLIGHT_PAD * 2,
      }
    : undefined;

  return (
    <div
      className="tour-overlay"
      data-motion={reduced ? "reduce" : "full"}
      data-centered={centered ? "true" : undefined}
      data-preparing={preparing ? "true" : undefined}
      role="presentation"
    >
      {showSpotlight ? (
        <div
          className="tour-spotlight"
          data-preparing={preparing ? "true" : undefined}
          style={spotlightStyle}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-overlay__veil" aria-hidden="true" />
      )}

      <section
        ref={cardRef}
        className="tour-card onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={preparing ? "true" : undefined}
        data-placement={cardPos?.placement}
        data-centered={centered ? "true" : undefined}
        data-welcome={welcome ? "true" : undefined}
        data-preparing={preparing ? "true" : undefined}
        data-critical={step.critical ? "true" : undefined}
        style={
          cardPos
            ? {
                top: cardPos.top,
                left: cardPos.left,
                ["--arrow-offset" as string]: `${cardPos.arrowOffset}px`,
              }
            : undefined
        }
        onKeyDown={(event) => trapFocus(event, cardRef.current)}
      >
        {!centered && cardPos && !preparing ? (
          <span className="tour-card__arrow" aria-hidden="true" />
        ) : null}

        <header className="onboarding__head">
          <p className="onboarding__kicker">{step.kicker}</p>
          <h2 id={titleId} className="onboarding__title">
            {step.title}
          </h2>
        </header>

        <p id={bodyId} className="onboarding__body">
          {step.body}
        </p>

        {step.callout ? (
          <p
            className="onboarding__callout"
            data-critical={step.critical ? "true" : undefined}
          >
            {step.callout}
          </p>
        ) : null}

        <div className="onboarding__progress-row">
          <ol className="onboarding__progress" aria-label="Tutorial progress">
            {STEPS.map((item, index) => (
              <li
                key={item.title}
                className="onboarding__dot"
                data-active={index === stepIndex ? "true" : undefined}
                data-done={index < stepIndex ? "true" : undefined}
                aria-current={index === stepIndex ? "step" : undefined}
                aria-label={`Step ${index + 1} of ${STEPS.length}: ${item.title}`}
              />
            ))}
          </ol>
          <span className="onboarding__step-count" aria-hidden="true">
            {String(stepIndex + 1).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
          </span>
        </div>

        <footer className="onboarding__actions">
          <button
            type="button"
            className="btn btn--ghost onboarding__skip"
            onClick={() => dismiss("skipped")}
          >
            skip
          </button>
          <span className="onboarding__nav">
            {stepIndex > 0 ? (
              <button
                type="button"
                className="btn btn--ghost onboarding__back"
                disabled={preparing}
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              >
                back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className="btn onboarding__next"
              disabled={preparing}
              data-state={preparing ? "loading" : undefined}
              onClick={() => {
                if (last) {
                  dismiss("done");
                  return;
                }
                setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
              }}
            >
              {preparing ? preparingLabel : last ? "start exploring" : "next"}
            </button>
          </span>
        </footer>

        <p className="onboarding__hint" id={liveId} aria-live="polite">
          {preparing
            ? preparingLabel
            : `Esc to skip · ${String(stepIndex + 1).padStart(2, "0")}/${String(STEPS.length).padStart(2, "0")}`}
        </p>
      </section>
    </div>
  );
}

export { ONBOARDING_STORAGE_KEY };
