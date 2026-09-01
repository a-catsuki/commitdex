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
const SPOTLIGHT_PAD = 8;
const CARD_GAP = 16;
const ARROW_SIZE = 10;
const VIEW_MARGIN = 16;
const SCROLL_WAIT_MS = 480;
const TARGET_RETRY_MS = 120;
const TARGET_RETRIES = 24;

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
};

const STEPS: TourStep[] = [
  {
    kicker: "field guide // v0.1",
    title: "Welcome to the dex",
    body:
      "Commitdex reads commit messages and timestamps — never the diff — then prints collectible creature cards. Two paths: roast one message, or scan a whole GitHub history.",
  },
  {
    kicker: "step 01 // specimen lab",
    title: "Paste a commit",
    body:
      "Use the classifier at the top of home (--classify). Drop any commit message, hit enter, and wait for your roasted creature card. Sample commits work if you are shy.",
    callout: "Home → paste message → print card",
    target: "classify",
    route: "/",
    hash: "classify",
    placement: "bottom",
  },
  {
    kicker: "step 02 // trainer scan",
    title: "Scan a GitHub username",
    body:
      "Scroll to “Scan a trainer” or hit --bounties. Enter a public GitHub handle. We cluster commit messages into a trainer dossier and preview your chaos score.",
    callout: "Public repos only · preview is free",
    target: "scan",
    route: "/",
    hash: "scan",
    placement: "top",
  },
  {
    kicker: "step 03 // critical",
    title: "Verify GitHub to claim",
    body:
      "Preview scans do not stick. To save your profile to Most Wanted, click --verify-github in the nav and sign in with the same GitHub account you scanned. Then scan again to claim.",
    callout: "Same account or it stays a ghost preview",
    target: "verify-github",
    placement: "bottom",
  },
  {
    kicker: "step 04 // optional loot",
    title: "Bounties & daily pick",
    body:
      "Claimed trainers land on Most Wanted (--bounties). After claiming, spin the reel for a featured card. Your dossier unlocks daily pick and the photobooth.",
    callout: "Leaderboard → reel → dossier perks",
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

  if (active === last) {
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
  const gap = CARD_GAP + ARROW_SIZE;
  const spaces: Record<Placement, number> = {
    top: rect.top - VIEW_MARGIN,
    bottom: window.innerHeight - rect.bottom - VIEW_MARGIN,
    left: rect.left - VIEW_MARGIN,
    right: window.innerWidth - rect.right - VIEW_MARGIN,
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

  left = Math.max(VIEW_MARGIN, Math.min(left, window.innerWidth - cardW - VIEW_MARGIN));
  top = Math.max(VIEW_MARGIN, Math.min(top, window.innerHeight - cardH - VIEW_MARGIN));

  const targetCenterX = rect.left + rect.width / 2;
  const targetCenterY = rect.top + rect.height / 2;
  const arrowOffset =
    placement === "top" || placement === "bottom"
      ? Math.min(Math.max(targetCenterX - left, 24), cardW - 24)
      : Math.min(Math.max(targetCenterY - top, 24), cardH - 24);

  return { top, left, placement, arrowOffset };
}

type Props = {
  manual?: boolean;
  onClose?: () => void;
};

export function OnboardingTour({ manual = false, onClose }: Props) {
  const titleId = useId();
  const bodyId = useId();
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

    if (!step.target || !spotRect) {
      setCardPos({
        top: Math.max(VIEW_MARGIN, (window.innerHeight - cardH) / 2),
        left: Math.max(VIEW_MARGIN, (window.innerWidth - cardW) / 2),
        placement: "bottom",
        arrowOffset: cardW / 2,
      });
      return;
    }

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
      setSpotRect(null);
      setCardPos(null);
      targetElRef.current = null;

      if (step.route && pathname !== step.route) {
        router.push(`${step.route}${step.hash ? `#${step.hash}` : ""}`);
        return;
      }

      let target: HTMLElement | null = null;
      if (step.target) {
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
        target.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        });
        if (!reduced) await sleep(SCROLL_WAIT_MS);
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

    function refreshSpot() {
      const el = targetElRef.current;
      if (!el) return;
      setSpotRect(el.getBoundingClientRect());
    }

    window.addEventListener("scroll", refreshSpot, true);
    window.addEventListener("resize", refreshSpot);
    return () => {
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
    nextRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [dismiss, open, stepIndex]);

  if (!open) return null;

  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;
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
        ref={cardRef}
        className="tour-card onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={preparing ? "true" : undefined}
        data-placement={cardPos?.placement}
        data-centered={centered ? "true" : undefined}
        style={
          cardPos
            ? {
                top: cardPos.top,
                left: cardPos.left,
              }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
        onKeyDown={(event) => trapFocus(event, cardRef.current)}
      >
        {!centered && cardPos ? (
          <span
            className="tour-card__arrow"
            aria-hidden="true"
            style={
              cardPos.placement === "top" || cardPos.placement === "bottom"
                ? { left: cardPos.arrowOffset }
                : { top: cardPos.arrowOffset }
            }
          />
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
          <p className="onboarding__callout" aria-label="Quick tip">
            {step.callout}
          </p>
        ) : null}

        <ol
          className="onboarding__progress"
          aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
        >
          {STEPS.map((_, index) => (
            <li
              key={index}
              className="onboarding__dot"
              data-active={index === stepIndex ? "true" : undefined}
              data-done={index < stepIndex ? "true" : undefined}
              aria-hidden="true"
            />
          ))}
        </ol>

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
                className="btn btn--ghost"
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              >
                back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className="btn"
              disabled={preparing}
              onClick={() => {
                if (last) {
                  dismiss("done");
                  return;
                }
                setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
              }}
            >
              {preparing ? "scrolling…" : last ? "done" : "next"}
            </button>
          </span>
        </footer>

        <p className="onboarding__hint">
          Esc to skip · {stepIndex + 1}/{STEPS.length}
        </p>
      </section>
    </div>
  );
}

export { ONBOARDING_STORAGE_KEY };
