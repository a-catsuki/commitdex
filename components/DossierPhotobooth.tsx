"use client";

import dynamic from "next/dynamic";
import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import { sessionMatchesTrainer } from "@/lib/github-auth";
import { prefetchNsfwModel } from "@/lib/nsfw-client";
import { COPY } from "@/lib/public-error";

const Photobooth = dynamic(
  () => import("@/components/Photobooth").then((m) => m.Photobooth),
  { ssr: false },
);

type Props = {
  username: string;
  existingPhotoUrl?: string | null;
};

/** Compact launch control + modal booth for the trainer dossier. */
export function DossierPhotobooth({
  username,
  existingPhotoUrl = null,
}: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const login = session?.login;
  const canBooth = sessionMatchesTrainer(login, username);
  const label = existingPhotoUrl ? "retake mugshot" : "add mugshot";

  if (status === "loading") {
    return (
      <div className="dossier__booth-tray">
        <p className="dossier__booth-hint" aria-live="polite">
          checking GitHub…
        </p>
      </div>
    );
  }

  if (!login) {
    return (
      <div className="dossier__booth-tray">
        <p className="dossier__booth-hint">{COPY.verifyGithub}</p>
        <button
          type="button"
          className="btn"
          onClick={() =>
            void signIn("github", {
              callbackUrl:
                typeof window !== "undefined" ? window.location.href : "/",
            })
          }
        >
          Verify with GitHub
        </button>
      </div>
    );
  }

  if (!canBooth) {
    return (
      <div className="dossier__booth-tray">
        <p className="dossier__booth-hint" role="status">
          Signed in as @{login}. {COPY.photoWrongAccount}
        </p>
      </div>
    );
  }

  return (
    <div className="dossier__booth-tray">
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          prefetchNsfwModel();
          setOpen(true);
        }}
        aria-label={
          existingPhotoUrl
            ? "Open photobooth to retake mugshot"
            : "Open photobooth to add mugshot"
        }
      >
        {label}
      </button>
      {open ? (
        <Photobooth
          username={username}
          existingPhotoUrl={existingPhotoUrl}
          variant="dossier"
          onSkip={() => setOpen(false)}
          onSaved={() => setOpen(false)}
          onRemoved={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
