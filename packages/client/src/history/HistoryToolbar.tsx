import { For, Show } from "solid-js";

import { span } from "../history.ts";
import { Input } from "../ui/zaidan/input.tsx";
import { Button } from "../ui/zaidan/button.tsx";
import { NativeSelect } from "../ui/zaidan/native-select.tsx";
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
    <label class="flex items-center gap-2 text-muted-foreground">
      Showing
      <NativeSelect
        class="text-foreground"
        value={props.pinned ? "custom" : props.range}
        onChange={(event) => props.onRange(event.currentTarget.value)}
      >
        <For each={RANGES}>
          {(one) => <option value={one.id}>{one.label}</option>}
        </For>
        <Show when={props.pinned}>
          <option value="custom">Chosen dates</option>
        </Show>
      </NativeSelect>
    </label>

    <Input
      type="date"
      class="w-auto!"
      aria-label="Jump to a date"
      onInput={(event) => props.onDay(event.currentTarget.value)}
    />

    <Show when={props.pinned}>
      <Button size="sm" variant="ghost" onClick={props.onClear}>
        Clear dates
      </Button>
    </Show>
  </>
);

export const HistorySummary = (props: {
  spanLabel: string;
  totals: Totals;
}) => (
  <div class="flex flex-wrap items-baseline gap-x-4 tabular-nums">
    <span>{props.spanLabel}</span>
    <span class="text-muted-foreground">
      {plural(props.totals.runs, "run")} · {span(props.totals.seconds)} ·{" "}
      {props.totals.kills.toLocaleString()} kills ·{" "}
      {props.totals.deaths.toLocaleString()} deaths
    </span>
  </div>
);
