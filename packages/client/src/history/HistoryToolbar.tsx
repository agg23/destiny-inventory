import { For, Show } from "solid-js";

import { span } from "../history.ts";
import { RANGES } from "./range.ts";
import { plural } from "./runFormat.ts";
import type { Totals } from "./totals.ts";

export const HistoryToolbar = (props: {
  range: string;
  pinned: boolean;
  spanLabel: string;
  totals: Totals;
  onRange: (id: string) => void;
  onDay: (day: string) => void;
  onClear: () => void;
}) => (
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
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
      class="text-input inline"
      aria-label="Jump to a date"
      onInput={(event) => props.onDay(event.currentTarget.value)}
    />

    <Show when={props.pinned}>
      <button type="button" class="button small ghost" onClick={props.onClear}>
        Clear dates
      </button>
    </Show>

    <span class="ml-auto flex flex-wrap items-baseline gap-x-4 text-md tabular-nums">
      <span class="text-text">{props.spanLabel}</span>
      <span class="text-dim">
        {plural(props.totals.runs, "run")} · {span(props.totals.seconds)} ·{" "}
        {props.totals.kills.toLocaleString()} kills ·{" "}
        {props.totals.deaths.toLocaleString()} deaths
      </span>
    </span>
  </div>
);
