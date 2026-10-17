import { For } from "solid-js";

import { HEADING, LABEL, SECTION } from "../../components/lib/text.ts";
import { weekdayTime } from "../../core/time.ts";
import {
  nextDailyReset,
  nextWeekendReset,
  nextWeeklyReset,
  remaining,
  xurPresent,
} from "../../core/todo/reset.ts";

export interface Deadline {
  name: string;
  note: string;
  at: number;
}

export const deadlines = (now: number): Deadline[] => [
  {
    name: "Daily",
    note: "17:00 UTC",
    at: nextDailyReset(now),
  },
  {
    name: "Weekly",
    note: "Tuesday 17:00 UTC",
    at: nextWeeklyReset(now),
  },
  {
    name: xurPresent(now) ? "Xûr leaves" : "Xûr arrives",
    note: xurPresent(now) ? "At the weekly reset" : "Friday 09:00 UTC",
    at: xurPresent(now) ? nextWeeklyReset(now) : nextWeekendReset(now),
  },
];

export const Resets = (props: { resets: Deadline[]; now: number }) => (
  <section class={SECTION}>
    <h2 class={HEADING}>Resets</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
      <For each={props.resets}>
        {(row) => (
          <div class="flex min-w-0 flex-col gap-1 border-l-2 border-input pl-3">
            <span class={LABEL}>{row.name}</span>
            <span class="text-2xl leading-tight tabular-nums">
              {remaining(row.at - props.now)}
            </span>
            <span class="text-xs text-muted-foreground">
              {row.note} · {weekdayTime(row.at)}
            </span>
          </div>
        )}
      </For>
    </div>
  </section>
);
