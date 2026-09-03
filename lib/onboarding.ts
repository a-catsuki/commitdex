export const ONBOARDING_STORAGE_KEY = "commitdex-onboarding-v1";

export const TOUR_NAV_SELECTOR = ".nav-term";
export const TOUR_VIEW_MARGIN = 16;
export const TOUR_SCROLL_MAX_MS = 900;
export const TOUR_SCROLL_POLL_MS = 40;
export const TOUR_SCROLL_STABLE_TICKS = 3;
export const TOUR_TARGET_RETRY_MS = 120;
export const TOUR_TARGET_RETRIES = 24;

export type OnboardingStatus = "pending" | "done" | "skipped";

export type TourSafeMargins = {
  top: number;
  bottom: number;
  side: number;
};

export function readOnboardingStatus(): OnboardingStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (value === "done" || value === "skipped") return value;
    return value === "pending" ? "pending" : null;
  } catch {
    return null;
  }
}

export function writeOnboardingStatus(status: OnboardingStatus): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, status);
  } catch {
    /* private mode */
  }
}

export function clearOnboardingStatus(): void {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function isBootPending(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-boot") === "pending";
}

export function waitForBootDismissed(): Promise<void> {
  if (!isBootPending()) return Promise.resolve();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!isBootPending()) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-boot"],
    });
  });
}

export function tourSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function getTourNavInset(): number {
  const nav = document.querySelector<HTMLElement>(TOUR_NAV_SELECTOR);
  if (!nav) return 0;
  return nav.getBoundingClientRect().height + 8;
}

export function getTourSafeMargins(): TourSafeMargins {
  const insetTop = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-top)") || "0",
  );
  const insetBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)") ||
      "0",
  );
  return {
    top: Math.max(TOUR_VIEW_MARGIN, insetTop || 0) + getTourNavInset(),
    bottom: Math.max(TOUR_VIEW_MARGIN, insetBottom || 0),
    side: Math.max(
      TOUR_VIEW_MARGIN,
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

export function isInStickyTourNav(el: HTMLElement): boolean {
  return Boolean(el.closest(TOUR_NAV_SELECTOR));
}

export async function waitForTourTarget(
  selector: string,
  cancelled?: () => boolean,
): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < TOUR_TARGET_RETRIES; attempt += 1) {
    if (cancelled?.()) return null;
    const target = document.querySelector<HTMLElement>(selector);
    if (target) return target;
    await tourSleep(TOUR_TARGET_RETRY_MS);
  }
  return null;
}

export async function waitForNextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function scrollTourTargetIntoView(
  target: HTMLElement,
  reduced: boolean,
  margins = getTourSafeMargins(),
): void {
  if (isInStickyTourNav(target)) return;

  const rect = target.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const visibleTop = margins.top;
  const visibleBottom = viewportH - margins.bottom;
  const visibleHeight = Math.max(120, visibleBottom - visibleTop);
  const targetCenter = rect.top + rect.height / 2;
  const desiredCenter = visibleTop + visibleHeight / 2;
  const delta = targetCenter - desiredCenter;
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - viewportH,
  );
  const nextY = Math.max(0, Math.min(window.scrollY + delta, maxScroll));

  if (Math.abs(nextY - window.scrollY) < 1) return;

  window.scrollTo({
    top: nextY,
    left: 0,
    behavior: reduced ? "auto" : "smooth",
  });
}

export async function waitForScrollSettled(reduced: boolean): Promise<void> {
  if (reduced) {
    await waitForNextPaint();
    return;
  }

  const browserWindow = window as Window & { onscrollend?: EventListener };
  if ("onscrollend" in browserWindow) {
    await new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        browserWindow.removeEventListener("scrollend", onScrollEnd);
        browserWindow.clearTimeout(timeout);
        resolve();
      };
      const onScrollEnd = () => finish();
      const timeout = browserWindow.setTimeout(finish, TOUR_SCROLL_MAX_MS);
      browserWindow.addEventListener("scrollend", onScrollEnd, { passive: true });
    });
    await waitForNextPaint();
    return;
  }

  const start = performance.now();
  let lastY = window.scrollY;
  let stable = 0;

  while (performance.now() - start < TOUR_SCROLL_MAX_MS) {
    await tourSleep(TOUR_SCROLL_POLL_MS);
    if (window.scrollY === lastY) {
      stable += 1;
      if (stable >= TOUR_SCROLL_STABLE_TICKS) {
        await waitForNextPaint();
        return;
      }
    } else {
      stable = 0;
      lastY = window.scrollY;
    }
  }

  await waitForNextPaint();
}

function getTourScrollbarWidth(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function applyTourScrollbarCompensation(active: boolean): void {
  const root = document.documentElement;
  const nav = document.querySelector<HTMLElement>(TOUR_NAV_SELECTOR);
  const width = active ? getTourScrollbarWidth() : 0;

  root.style.paddingRight = width > 0 ? `${width}px` : "";
  if (nav) nav.style.paddingRight = width > 0 ? `${width}px` : "";
}

export function setTourScrollLock(locked: boolean): void {
  if (locked) {
    document.documentElement.setAttribute("data-tour-scroll-lock", "");
    applyTourScrollbarCompensation(true);
    return;
  }

  document.documentElement.removeAttribute("data-tour-scroll-lock");
  applyTourScrollbarCompensation(false);
}
