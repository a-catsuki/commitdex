"use client";

import { type DexStage } from "@/lib/ritual";

const SPARKS = [
  "var(--type-lazy)",
  "var(--type-vague)",
  "var(--type-panic)",
  "var(--type-overconfident)",
  "var(--type-passive-aggressive)",
  "var(--type-corporate)",
  "var(--type-chaotic)",
  "var(--type-emoji)",
] as const;

type Props = {
  stage: DexStage;
  reduced: boolean;
};

export function PrintBay({ stage, reduced }: Props) {
  return (
    <div
      className="print-bay"
      data-state={reduced ? "still" : "printing"}
      aria-live="polite"
      aria-busy="true"
    >
      <p className="print-bay__kicker">{stage.kicker}</p>
      <p className="print-bay__title">{stage.title}</p>
      <p className="print-bay__detail">{stage.detail}</p>

      <div className="print-bay__slot" aria-hidden="true">
        <div className="print-bay__head" />
        <div className="print-bay__feed">
          <div className="print-bay__blank">
            <span className="print-bay__dots" />
          </div>
        </div>
        <span className="print-bay__scan" />
        <ul className="print-bay__sparks">
          {SPARKS.map((color) => (
            <li key={color} style={{ background: color }} />
          ))}
        </ul>
      </div>
    </div>
  );
}
