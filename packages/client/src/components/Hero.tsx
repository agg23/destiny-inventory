import type { JSX } from "solid-js";

import { tileArt } from "../core/activities/art.ts";
import { cn } from "./lib/cn.ts";
import { HERO } from "./lib/text.ts";

interface Props {
  art: string | undefined;
  typeName: string | undefined;
  class?: string;
  title: JSX.Element;
  children?: JSX.Element;
}

/** An activity's title and type over its art */
export const Hero = (props: Props) => (
  <div
    class={cn(HERO, props.class)}
    style={{ "--art": tileArt(props.art, props.typeName) }}
  >
    <h2 class="text-2xl leading-tight font-semibold">{props.title}</h2>
    <span class="text-foreground/80">{props.typeName}</span>
    {props.children}
  </div>
);
