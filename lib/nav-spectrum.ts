import type { CreatureType } from "./types";

export const NAV_TYPE_EVENT = "commitdex:nav-type";

export type NavTypeEventDetail = {
  type: CreatureType | null;
};
