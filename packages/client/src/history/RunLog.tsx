import { For } from "solid-js";

import { Chevron, Plate, Result, type PlateProps } from "./ActivityRow.tsx";
import { duration, playedSeconds, span, type HistoryRun } from "../history.ts";
import { clock, dayTitle, plural } from "./runFormat.ts";

export interface Day {
  day: string;
  runs: HistoryRun[];
}

export const RunLog = (props: {
  days: Day[];
  plateOf: (run: HistoryRun) => PlateProps;
  onOpen: (run: HistoryRun) => void;
}) => (
  <div class="card">
    <div class="card-header">
      <span class="card-title">Run log</span>
      <span class="card-subtitle">
        Every run, newest first · pick one to open its activity
      </span>
    </div>
    <div class="card-body p-0">
      <table class="table">
        <thead>
          <tr>
            <th class="w-72">Activity</th>
            <th />
            <th class="num w-36">Started</th>
            <th class="num w-36">Duration</th>
            <th class="num w-32">Kills</th>
            <th class="num w-32">Deaths</th>
            <th class="num w-36">Score</th>
            <th class="w-40">Result</th>
            <th class="w-8" />
          </tr>
        </thead>
        <For each={props.days}>
          {(day) => (
            <tbody>
              <tr class="day">
                <td colspan={9}>
                  <span class="section-label">
                    {dayTitle(day.day)}
                    <span class="text-sm normal-case tracking-normal tabular-nums text-dim">
                      {plural(day.runs.length, "run")} ·{" "}
                      {span(playedSeconds(day.runs))}
                    </span>
                  </span>
                </td>
              </tr>
              <For each={day.runs}>
                {(run) => (
                  <tr
                    class="group cursor-pointer"
                    onClick={() => props.onOpen(run)}
                  >
                    <td class="p-0">
                      <Plate {...props.plateOf(run)} />
                    </td>
                    <td />
                    <td class="num">{clock(run.startedAt)}</td>
                    <td class="num">{duration(run.durationSeconds)}</td>
                    <td class="num">{run.kills}</td>
                    <td class="num">{run.deaths}</td>
                    <td class="num">
                      {run.score > 0 ? run.score.toLocaleString() : "-"}
                    </td>
                    <Result completed={run.completed} />
                    <Chevron />
                  </tr>
                )}
              </For>
            </tbody>
          )}
        </For>
      </table>
    </div>
  </div>
);
