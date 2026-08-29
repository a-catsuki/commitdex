"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { NAV_TYPE_EVENT, type NavTypeEventDetail } from "@/lib/nav-spectrum";
import { TYPE_META } from "@/lib/type-meta";
import { isCreatureType, type CreatureType } from "@/lib/types";

type Props = {
  initialType?: CreatureType;
};

export function NavSpectrum({ initialType }: Props) {
  const [navType, setNavType] = useState<CreatureType | null>(initialType ?? null);

  useEffect(() => {
    function handleNavType(event: Event) {
      const detail = (event as CustomEvent<NavTypeEventDetail>).detail;

      if (detail?.type === null) {
        setNavType(initialType ?? null);
        return;
      }

      if (typeof detail?.type === "string" && isCreatureType(detail.type)) {
        setNavType(detail.type);
      }
    }

    window.addEventListener(NAV_TYPE_EVENT, handleNavType);
    return () => window.removeEventListener(NAV_TYPE_EVENT, handleNavType);
  }, [initialType]);

  const spectrumStyle = navType
    ? ({ "--nav-color": `var(${TYPE_META[navType].cssVar})` } as CSSProperties)
    : undefined;

  return (
    <div
      className="dex-spectrum"
      data-context={navType ? "type" : undefined}
      style={spectrumStyle}
      aria-hidden="true"
    />
  );
}
