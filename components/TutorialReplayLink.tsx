"use client";

import { useState } from "react";
import { OnboardingTour } from "@/components/OnboardingTour";

export function TutorialReplayLink() {
  const [replay, setReplay] = useState(false);

  return (
    <>
      <button
        type="button"
        className="foot-stmt__replay"
        onClick={() => setReplay(true)}
      >
        show tutorial
      </button>
      {replay ? (
        <OnboardingTour manual onClose={() => setReplay(false)} />
      ) : null}
    </>
  );
}
