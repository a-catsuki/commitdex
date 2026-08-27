"use client";

import { type ReactNode } from "react";

type Props = {
  children: ReactNode;
  reduced: boolean;
};

export function CardPack({ children, reduced }: Props) {
  return (
    <div className="card-pack" data-motion={reduced ? "reduce" : "spin"}>
      <div className="card-pack__rig">
        <div className="card-pack__face card-pack__face--back" aria-hidden="true">
          <span className="card-pack__foil">unidentified specimen</span>
        </div>
        <div className="card-pack__face card-pack__face--front">{children}</div>
      </div>
    </div>
  );
}
