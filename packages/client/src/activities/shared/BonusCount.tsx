import { Show } from "solid-js";

import { Icon } from "./ActivityRow.tsx";

const REMAINING = "Bonus engrams left this week";

export const BonusCount = (props: { count: number; glyph: string | undefined }) => (
  <Show when={props.count}>
    {(count) => (
      <span
        class="inline-flex items-center gap-1 tabular-nums text-cream"
        title={REMAINING}
      >
        <Icon icon={props.glyph} class="size-(--icon-xs)" />
        {count()}
      </span>
    )}
  </Show>
);
