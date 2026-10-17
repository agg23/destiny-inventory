import { Show } from "solid-js";

/** A tag's color swatch, or a dashed ring for no tag */
export const TagDot = (props: { color?: string }) => (
  <Show
    when={props.color}
    fallback={
      <span class="size-2 rounded-full border border-dashed border-input" />
    }
  >
    {(color) => (
      <span
        class="size-2 rounded-full"
        style={{ "background-color": `var(--color-${color()})` }}
      />
    )}
  </Show>
);
