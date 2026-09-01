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
  readOnboardingStatus,
  waitForBootDismissed,
  writeOnboardingStatus,
} from "@/lib/onboarding";
import { prefersReducedMotion } from "@/lib/ritual";

const BOOT_SETTLE_MS = 320;
const SPOTLIGHT_PAD = 12;
const CARD_GAP = 20;
const ARROW_SIZE = 10;
const ARROW_CLAMP = 32;
const VIEW_MARGIN = 16;
const SCROLL_MAX_MS = 720;
const SCROLL_POLL_MS = 48;
const SCROLL_STABLE_TICKS = 3;
const TARGET_RETRY_MS = 120;
const TARGET_RETRIES = 24;
const NAV_SELECTOR = ".nav-term";

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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getNavInset(): number {
  const nav = document.querySelector<HTMLElement>(NAV_SELECTOR);
  if (!nav) return 0;
  return nav.getBoundingClientRect().height + 8;
}

type SafeMargins = {
  top: number;
  bottom: number;
  side: number;
};

function getSafeMargins(): SafeMargins {
  const insetTop = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-top)") || "0",
  );
  const insetBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)") ||
      "0",
  );
  return {
    top: Math.max(VIEW_MARGIN, insetTop || 0) + getNavInset(),
    bottom: Math.max(VIEW_MARGIN, insetBottom || 0),
    side: Math.max(
      VIEW_MARGIN,
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-left)") ||
          "0",
      ) || 0,
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-right)") ||
          "0",
      ) || 0,
    ),
  };
}

function isInStickyNav(el: HTMLElement): boolean {
  return Boolean(el.closest(NAV_SELECTOR));
}

async function waitForScrollSettled(reduced: boolean): Promise<void> {
  if (reduced) return;

  const start = performance.now();
  let lastY = window.scrollY;
  let stable = 0;

  while (performance.now() - start < SCROLL_MAX_MS) {
    await sleep(SCROLL_POLL_MS);
    if (window.scrollY === lastY) {
      stable += 1;
      if (stable >= SCROLL_STABLE_TICKS) return;
    } else {
      stable = 0;
      lastY = window.scrollY;
    }
  }
}

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
  const margins = getSafeMargins();
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
  const margins = getSafeMargins();
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

  const dismiss = useCallback(
    (status: "done" | "skipped") => {
      writeOnboardingStatus(status);
      setOpen(false);
      targetElRef.current = null;
      setSpotRect(null);
      setCardPos(null);
      onClose?.();
    },
    [onClose],
  );

  const measureCard = useCallback(() => {
    const step = STEPS[stepIndex];
    const card = cardRef.current;
    if (!card) return;

    const cardW = card.offsetWidth;
    const cardH = card.offsetHeight;
    const margins = getSafeMargins();

    if (!step.target) {
      setCardPos({
        top: Math.max(margins.top, (window.innerHeight - cardH) / 2),
        left: Math.max(margins.side, (window.innerWidth - cardW) / 2),
        placement: "bottom",
        arrowOffset: cardW / 2,
      });
      return;
    }

    if (!spotRect) return;

    setCardPos(
      positionCard(
        spotRect,
        pickPlacement(spotRect, cardW, cardH, step.placement ?? "auto"),
        cardW,
        cardH,
      ),
    );
  }, [spotRect, stepIndex]);

  useEffect(() => {
    if (manual) return;
    if (readOnboardingStatus()) return;

    let cancelled = false;

    void (async () => {
      await waitForBootDismissed();
      if (cancelled) return;
      await sleep(BOOT_SETTLE_MS);
      if (cancelled || readOnboardingStatus()) return;
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [manual]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function prepareStep() {
      const step = STEPS[stepIndex];
      setPreparing(true);
      setPreparingLabel(step.route && pathname !== step.route ? "routing…" : "locating…");
      setSpotRect(null);
      setCardPos(null);
      targetElRef.current = null;

      if (step.route && pathname !== step.route) {
        router.push(`${step.route}${step.hash ? `#${step.hash}` : ""}`);
        return;
      }

      if (step.hash && typeof window !== "undefined") {
        const hash = `#${step.hash}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", `${pathname}${hash}`);
        }
      }

      let target: HTMLElement | null = null;
      if (step.target) {
        setPreparingLabel("locating…");
        for (let attempt = 0; attempt < TARGET_RETRIES; attempt += 1) {
          if (cancelled) return;
          target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
          if (target) break;
          await sleep(TARGET_RETRY_MS);
        }
      }

      if (step.target && !target) {
        setPreparing(false);
        return;
      }

      if (target) {
        if (!isInStickyNav(target)) {
          setPreparingLabel("scrolling…");
          target.scrollIntoView({
            behavior: reduced ? "auto" : "smooth",
            block: "center",
            inline: "nearest",
          });
          await waitForScrollSettled(reduced);
        } else if (!reduced) {
          await sleep(120);
        }

        if (cancelled) return;

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });

        if (cancelled) return;
        targetElRef.current = target;
        setSpotRect(target.getBoundingClientRect());
      }

      setPreparing(false);
    }

    void prepareStep();

    return () => {
      cancelled = true;
    };
  }, [open, pathname, reduced, router, stepIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    measureCard();
  }, [measureCard, open, preparing, spotRect, stepIndex]);

  useEffect(() => {
    if (!open) return;

    let raf = 0;

    function refreshSpot() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = targetElRef.current;
        if (!el) return;
        setSpotRect(el.getBoundingClientRect());
      });
    }

    window.addEventListener("scroll", refreshSpot, { capture: true, passive: true });
    window.addEventListener("resize", refreshSpot, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", refreshSpot, true);
      window.removeEventListener("resize", refreshSpot);
    };
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss("skipped");
    };

    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [dismiss, open]);

  useEffect(() => {
    if (!open || preparing) return;
    nextRef.current?.focus({ preventScroll: true });
  }, [open, preparing, stepIndex]);

  if (!open) return null;

  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;
  const welcome = stepIndex === 0;
  const centered = !step.target || !spotRect;
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
      role="presentation"
    >
      {spotRect ? (
        <div
          className="tour-spotlight"
          style={spotlightStyle}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-overlay__veil" aria-hidden="true" />
      )}

      <section
        key={stepIndex}
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
        {!centered && cardPos ? (
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
