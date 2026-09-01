export const ONBOARDING_STORAGE_KEY = "commitdex-onboarding-v1";

export type OnboardingStatus = "pending" | "done" | "skipped";

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
