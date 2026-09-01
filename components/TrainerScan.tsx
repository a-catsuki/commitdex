"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DexReel } from "@/components/DexReel";
import { sessionMatchesTrainer } from "@/lib/github-auth";
import {
  clearPendingClaim,
  getPendingClaim,
  setPendingClaim,
} from "@/lib/pending-claim";
import { TRAINER_STAGES } from "@/lib/ritual";
import type { CreatureCard } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "success";

type ScanPayload = {
  error?: string;
  trainer?: { github_username: string; featured_card?: CreatureCard | null };
  reel?: string[];
  saved?: boolean;
  cached?: boolean;
  alreadyExists?: boolean;
  locked?: boolean;
  canSpin?: boolean;
  spinLockedReason?: string | null;
};

export function TrainerScan() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>();
  const [stage, setStage] = useState(0);
  const [handle, setHandle] = useState<string | null>(null);
  const [reel, setReel] = useState<string[]>([]);
  const [featured, setFeatured] = useState<CreatureCard | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showExistingProfile, setShowExistingProfile] = useState(false);
  const closeExistingProfileRef = useRef<HTMLButtonElement>(null);
  const autoClaimRef = useRef(false);

  useEffect(() => {
    if (status !== "loading") return;
    const tick = window.setInterval(() => {
      setStage((index) => (index + 1) % TRAINER_STAGES.length);
    }, 900);
    return () => window.clearInterval(tick);
  }, [status]);

  useEffect(() => {
    if (!showExistingProfile) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowExistingProfile(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    closeExistingProfileRef.current?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showExistingProfile]);

  const scan = useCallback(
    async (rawUsername?: string) => {
      const trimmed = (rawUsername ?? username).trim().replace(/^@/, "");
      if (!trimmed) return;
      setUsername(trimmed);
      setStatus("loading");
      setError(undefined);
      setStage(0);
      setHandle(null);
      setReel([]);
      setFeatured(null);
      setCanSpin(false);
      setSaved(false);
      setShowExistingProfile(false);
      try {
        const response = await fetch("/api/trainer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmed }),
        });
        const payload = (await response.json().catch(() => ({}))) as ScanPayload;
        if (!response.ok) {
          setStatus("error");
          setError(
            typeof payload.error === "string" && payload.error
              ? payload.error
              : "The pokedex jammed. Try again in a minute.",
          );
          return;
        }
        const nextHandle = payload.trainer?.github_username ?? trimmed.toLowerCase();
        const nextFeatured = payload.trainer?.featured_card ?? null;
        const nextCanSpin = payload.canSpin ?? !nextFeatured;
        const nextSaved = payload.saved ?? false;
        setHandle(nextHandle);
        setReel(payload.reel ?? []);
        setFeatured(nextFeatured);
        setCanSpin(nextCanSpin);
        setSaved(nextSaved);
        setStatus("success");
        if (nextSaved) {
          clearPendingClaim();
        } else {
          setPendingClaim(nextHandle);
        }
        const existingProfile = payload.alreadyExists ?? payload.cached ?? false;
        setShowExistingProfile(existingProfile);
        // Locked foil: skip reel, open dossier (reason lives on the poster).
        if (nextFeatured && !nextCanSpin && !existingProfile) {
          router.push(`/t/${nextHandle}`);
        }
      } catch {
        setStatus("error");
        setError("The pokedex jammed. Try again in a minute.");
      }
    },
    [router, username],
  );

  useEffect(() => {
    if (authStatus !== "authenticated" || autoClaimRef.current || status === "loading") return;
    const pending = getPendingClaim();
    if (!pending) return;
    const login = session?.login ?? session?.user?.login;
    if (!sessionMatchesTrainer(login, pending)) return;
    autoClaimRef.current = true;
    const timer = window.setTimeout(() => {
      void scan(pending);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authStatus, scan, session, status]);

  const busy = status === "loading";
  const empty = username.trim().length === 0;
  const showReel = status === "success" && handle && reel.length > 0 && canSpin;
  const showUnsavedNotice = status === "success" && handle && !saved && !showReel;

  return (
    <section className="hunt" id="scan">
      <h2 className="hunt__head">Scan a trainer</h2>
      <p className="hunt__lede">
        Public GitHub username. We read commit messages and timestamps, never the diff. Verify the
        matching GitHub login to save the trainer and crank the reel.
      </p>
      <form
        className="prompt"
        onSubmit={(event) => {
          event.preventDefault();
          if (!empty && !busy) void scan();
        }}
      >
        <label className="prompt__field" htmlFor="gh-username">
          <span className="prompt__sr">GitHub username</span>
          <span className="prompt__prefix" aria-hidden="true">
            <span className="prompt__dollar">$</span>
            git log --author=&quot;
          </span>
          <input
            id="gh-username"
            className="prompt__input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={39}
            disabled={busy}
            aria-invalid={status === "error"}
            aria-describedby={error ? "hunt-error" : "hunt-help"}
          />
          <span className="prompt__suffix" aria-hidden="true">
            &quot;
          </span>
        </label>
        <div className="prompt__row">
          <p id="hunt-help" className="prompt__help">
            Public repos only. Verify to land on Most Wanted.
          </p>
          <button
            type="submit"
            className="btn"
            disabled={empty || busy}
            aria-busy={busy}
            data-state={busy ? "loading" : status === "success" ? "success" : "idle"}
          >
            {busy ? TRAINER_STAGES[stage] : "scan history"}
          </button>
        </div>
        {error ? (
          <p id="hunt-error" className="prompt__error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      {showUnsavedNotice ? (
        <p className="prompt__help" role="status">
          Preview only. Verify GitHub as @{handle}, then scan again to post on Most Wanted.
        </p>
      ) : null}
      {showReel ? (
        <DexReel
          username={handle}
          reel={reel}
          mode={featured ? "respin" : "first"}
          saved={saved}
        />
      ) : null}
      {showExistingProfile && handle ? (
        <div className="existing-profile-overlay">
          <button
            type="button"
            className="existing-profile-overlay__backdrop"
            aria-label="Close existing trainer notice"
            onClick={() => setShowExistingProfile(false)}
          />
          <section
            className="existing-profile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="existing-profile-title"
            aria-describedby="existing-profile-copy"
          >
            <p className="existing-profile__kicker">DEX ALERT // MATCH FOUND</p>
            <h2 id="existing-profile-title">TRAINER ALREADY IN THE DEX</h2>
            <p id="existing-profile-copy" className="existing-profile__copy">
              That handle already has a public dossier. The evidence is warmed up.
            </p>
            <p className="existing-profile__handle">@{handle}</p>
            <div className="existing-profile__actions">
              <Link className="btn" href={`/t/${encodeURIComponent(handle)}`}>
                VIEW PROFILE
              </Link>
              <button
                ref={closeExistingProfileRef}
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowExistingProfile(false)}
              >
                CLOSE
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
