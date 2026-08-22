import { For, Show } from "solid-js";

import { span } from "../history.ts";
import { Button } from "../ui/Button.tsx";
import { RANGES } from "./range.ts";
import { plural } from "./runFormat.ts";
import type { Totals } from "./totals.ts";

export const HistoryRange = (props: {
  range: string;
  pinned: boolean;
  onRange: (id: string) => void;
  onDay: (day: string) => void;
  onClear: () => void;
}) => (
  <>
    <label class="flex items-center gap-2 text-md text-dim">
      Showing
      <select
        class="select"
        value={props.pinned ? "custom" : props.range}
        onChange={(event) => props.onRange(event.currentTarget.value)}
      >
        <For each={RANGES}>
          {(one) => <option value={one.id}>{one.label}</option>}
        </For>
        <Show when={props.pinned}>
          <option value="custom">Chosen dates</option>
        </Show>
      </select>
    </label>

    <input
      type="date"
      class="text-input inline w-auto"
      aria-label="Jump to a date"
      onInput={(event) => props.onDay(event.currentTarget.value)}
    />

    <Show when={props.pinned}>
      <Button size="xs" variant="ghost" onClick={props.onClear}>
        Clear dates
      </Button>
    </Show>
  </>
);

export const HistorySummary = (props: {
  spanLabel: string;
  totals: Totals;
}) => (
  <div class="flex flex-wrap items-baseline gap-x-4 text-md tabular-nums">
    <span class="text-text">{props.spanLabel}</span>
    <span class="text-dim">
      {plural(props.totals.runs, "run")} · {span(props.totals.seconds)} ·{" "}
      {props.totals.kills.toLocaleString()} kills ·{" "}
      {props.totals.deaths.toLocaleString()} deaths
    </span>
  </div>
);
