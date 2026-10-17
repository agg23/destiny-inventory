import type { JSX } from "solid-js";

/** Stroke attributes every glyph path carries */
export const STROKE = { stroke: "currentColor", "stroke-width": "1.75" };

/** A 24px outline icon drawn in the current text color */
export const Glyph = (props: { class?: string; children: JSX.Element }) => (
  <svg class={props.class} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {props.children}
  </svg>
);
