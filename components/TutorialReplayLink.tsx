"use client";

export function TutorialReplayLink() {
  return (
    <button
      type="button"
      className="foot-stmt__replay"
      onClick={() => window.dispatchEvent(new Event("commitdex:replay-tutorial"))}
    >
      show tutorial
    </button>
  );
}
