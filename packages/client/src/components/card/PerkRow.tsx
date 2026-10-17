import { Show, type JSX } from "solid-js";

import type { StatChange } from "../../core/items/perks.ts";
import { BungieImage } from "../BungieImage.tsx";
import { Changes } from "./Stats.tsx";

const perkIconClass = (enhanced?: boolean, square?: boolean): string =>
  square
    ? "size-8 flex-none"
    : `size-8 flex-none rounded-full border bg-foreground/8 ${
        enhanced ? "border-light" : "border-foreground/50"
      }`;

export const PerkIcon = (props: {
  icon: string | undefined;
  enhanced?: boolean;
  square?: boolean;
}) => (
  <BungieImage
    path={props.icon}
    class={perkIconClass(props.enhanced, props.square)}
    lazy
    fallback={<span class={perkIconClass(props.enhanced, props.square)} />}
  />
);

/** An icon beside a perk's name and description */
export const PERK = "flex items-start gap-3 py-1.5";

export const PERK_NAME = "block font-medium text-foreground";

const PERK_TITLE =
  "flex flex-wrap items-center gap-1.5 font-medium text-foreground";

export const PERK_TEXT = "block text-xs whitespace-pre-wrap text-muted-foreground";

interface Props {
  icon: string | undefined;
  enhanced?: boolean;
  square?: boolean;
  badged?: boolean;
  name: JSX.Element;
  stats?: StatChange[];
  description?: string;
  children?: JSX.Element;
}

/** A perk's icon, name, stat changes and description, then any children */
export const PerkRow = (props: Props) => (
  <div class={PERK}>
    <PerkIcon
      icon={props.icon}
      enhanced={props.enhanced}
      square={props.square}
    />
    <div class="min-w-0">
      <b
        class={props.badged ? PERK_TITLE : PERK_NAME}
        classList={{ "text-light!": !!props.enhanced }}
      >
        {props.name}
      </b>
      <Show when={props.stats}>{(stats) => <Changes stats={stats()} />}</Show>
      <Show when={props.description}>
        <span class={PERK_TEXT}>{props.description}</span>
      </Show>
      {props.children}
    </div>
  </div>
);
