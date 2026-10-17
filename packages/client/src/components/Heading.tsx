import { Show, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

import { cn } from "./lib/cn.ts";
import { HEADING, HEADING_NOTE } from "./lib/text.ts";

interface Props {
  note?: string | number;
  noteTitle?: string;
  as?: "h2" | "h3";
  class?: string;
  children: JSX.Element;
}

/** A section heading with a muted note beside it */
export const Heading = (props: Props) => (
  <Dynamic
    component={props.as ?? "h2"}
    class={cn(HEADING, "flex items-baseline gap-2", props.class)}
  >
    {props.children}
    <Show when={props.note !== undefined}>
      <span class={HEADING_NOTE} title={props.noteTitle}>
        {props.note}
      </span>
    </Show>
  </Dynamic>
);
