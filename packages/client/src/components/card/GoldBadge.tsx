import type { JSX } from "solid-js";

import { Badge } from "../lib/zaidan/badge.tsx";

/** Light gold, for Enhanced and other game-marked states */
export const GOLD_BADGE = "border-light/40 text-light";

export const GoldBadge = (props: { children: JSX.Element }) => (
  <Badge variant="outline" class={GOLD_BADGE}>
    {props.children}
  </Badge>
);
