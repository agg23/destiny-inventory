import { For } from "solid-js";

import {
  nextDailyReset,
  nextWeekendReset,
  nextWeeklyReset,
  remaining,
  xurPresent,
} from "../reset.ts";
import { stamp } from "./todoFormat.ts";

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
  <section class="todo-section">
    <h2 class="section-label">Resets</h2>
    <div class="reset-strip">
      <For each={props.resets}>
        {(row) => (
          <div class="reset-block">
            <span class="reset-label">{row.name}</span>
            <span class="reset-clock tabular-nums">
              {remaining(row.at - props.now)}
            </span>
            <span class="reset-when">
              {row.note} · {stamp(row.at)}
            </span>
          </div>
        )}
      </For>
    </div>
  </section>
);
