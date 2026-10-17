import { Show } from "solid-js";

export const PanelGlyph = (props: { slashed?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      stroke="currentColor"
      stroke-width="1.75"
    />
    <path
      d="M14.5 4.5 L 14.5 19.5"
      stroke="currentColor"
      stroke-width="1.75"
    />
    <Show when={props.slashed}>
      <path d="M3 21 L 21 3" stroke="var(--bg)" stroke-width="4" />
      <path d="M3 21 L 21 3" stroke="currentColor" stroke-width="1.75" />
    </Show>
  </svg>
);
