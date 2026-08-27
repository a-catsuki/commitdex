"use client";

import { useEffect } from "react";

const STORAGE_KEY = "commitdex-booted";
const BOOT_MS = 2200;

function dismissBoot() {
  document.documentElement.removeAttribute("data-boot");
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function BootOverlay() {
  useEffect(() => {
    if (document.documentElement.getAttribute("data-boot") !== "pending") {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissBoot();
      }
    };

    const timer = window.setTimeout(dismissBoot, BOOT_MS);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="boot" aria-hidden="true" onClick={dismissBoot}>
      <p className="boot__mark">COMMITDEX v0.1</p>
      <p className="boot__line">booting pokedex kernel…</p>
      <ul className="boot__types">
        <li>lazy</li>
        <li>vague</li>
        <li>panic</li>
        <li>overconfident</li>
        <li>passive-aggressive</li>
        <li>corporate</li>
        <li>chaotic</li>
        <li>emoji</li>
      </ul>
      <p className="boot__ready">READY</p>
      <p className="boot__hint">click or Esc to skip</p>
    </div>
  );
}
