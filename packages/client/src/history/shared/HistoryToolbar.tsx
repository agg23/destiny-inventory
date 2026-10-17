import { Show } from "solid-js";

import { Select } from "../../components/lib/Select.tsx";
import { Button } from "../../components/lib/zaidan/button.tsx";
import { Input } from "../../components/lib/zaidan/input.tsx";
import { plural } from "../../core/text.ts";
import { span } from "../../core/time.ts";
import { RANGES } from "./range.ts";
import type { Totals } from "./totals.ts";

const RANGE_NAMES = Object.fromEntries(
  RANGES.map((one) => [one.id, one.label]),
);

export const HistoryRange = (props: {
  range: string;
  pinned: boolean;
  onRange: (id: string) => void;
  onDay: (day: string) => void;
  onClear: () => void;
}) => (
  <>
    <Select
      label="Showing"
      value={props.pinned ? "custom" : props.range}
      options={RANGES.map((one) => one.id)}
      names={RANGE_NAMES}
      onChange={props.onRange}
    >
      <Show when={props.pinned}>
        <option value="custom">Chosen dates</option>
      </Show>
    </Select>

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
