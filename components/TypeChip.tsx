import type { CSSProperties } from "react";
import { TYPE_META } from "@/lib/type-meta";
import type { CreatureType } from "@/lib/types";

export function TypeChip({ type }: { type: CreatureType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className="type-chip"
      data-type={type}
      style={
        {
          "--chip-ink": `var(${meta.cssVar})`,
          "--chip-paper": `var(${meta.paperVar})`,
        } as CSSProperties
      }
    >
      {meta.label}
    </span>
  );
}
