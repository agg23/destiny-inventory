import type { DestinyPostGameCarnageReportData } from "bungie-api-ts/destiny2";
import { For, Show } from "solid-js";

import type { ActivityTables } from "../activities.ts";
import { Chevron, Result } from "./ActivityRow.tsx";
import { BUNGIE } from "../bungie.ts";
import { duration, type HistoryRun } from "../history.ts";
import { Report } from "./RunReport.tsx";
import { METRICS, RunGraph, type Metric } from "./RunGraph.tsx";
import { ratio, rungColor, score, stamp } from "./runFormat.ts";
import type { Best } from "./totals.ts";

export const ActivityPage = (props: {
  label: string;
  difficulty: string | undefined;
  typeName: string | undefined;
  art: string | undefined;
  best: Best;
  oldestFirst: HistoryRun[];
  newestFirst: HistoryRun[];
  metric: Metric;
  onMetric: (id: string) => void;
  opened: HistoryRun | undefined;
  onPick: (run: HistoryRun) => void;
  report: DestinyPostGameCarnageReportData | undefined;
  reportLoading: boolean;
  reportFailed: boolean;
  tables: ActivityTables | undefined;
}) => (
  <>
    <div class="card overflow-hidden">
      <div
        class="hero-art flex min-h-[200px] flex-col items-center justify-center gap-1 p-6 text-center"
        style={
          props.art ? { "--art": `url(${BUNGIE}${props.art})` } : undefined
        }
      >
        <h2 class="m-0 text-2xl leading-tight">
          {props.label}
          <Show when={props.difficulty}>
            {(rung) => <span class={rungColor(rung())}>: {rung()}</span>}
          </Show>
        </h2>
        <span class="text-md text-text">{props.typeName}</span>
        <span class="mt-2 flex flex-wrap justify-center gap-x-5 text-md tabular-nums text-fg">
          <span>
            <b>{props.best.runs}</b> <span class="text-dim">entered</span>
          </span>
          <span>
            <b>{props.best.cleared}</b> <span class="text-dim">cleared</span>
          </span>
          <Show when={props.best.fastest !== undefined}>
            <span>
              <b>{duration(props.best.fastest ?? 0)}</b>{" "}
              <span class="text-dim">fastest</span>
            </span>
          </Show>
          <Show when={props.best.score > 0}>
            <span>
              <b>{props.best.score.toLocaleString()}</b>{" "}
              <span class="text-dim">best score</span>
            </span>
          </Show>
        </span>
      </div>

      <Show when={props.oldestFirst.length > 1}>
        <div class="card-body flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p class="section-label m-0 flex-1">Historical performance</p>
            <label class="flex items-center gap-2 text-md text-dim">
              Comparing
              <select
                class="select"
                value={props.metric.id}
                onChange={(event) => props.onMetric(event.currentTarget.value)}
              >
                <For each={METRICS}>
                  {(one) => <option value={one.id}>{one.label}</option>}
                </For>
              </select>
            </label>
          </div>
          <RunGraph
            runs={props.oldestFirst}
            metric={props.metric}
            opened={props.opened?.instanceId}
            onPick={props.onPick}
          />
        </div>
      </Show>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Runs</span>
        <span class="card-subtitle">
          Newest first · pick one for its full report
        </span>
      </div>
      <div class="card-body p-0">
        <table class="table">
          <thead>
            <tr>
              <th>Started</th>
              <th class="num">Duration</th>
              <th class="num">Kills</th>
              <th class="num">Assists</th>
              <th class="num">Deaths</th>
              <th class="num">K/D</th>
              <th class="num">Score</th>
              <th>Result</th>
              <th class="w-8" />
            </tr>
          </thead>
          <tbody>
            <For each={props.newestFirst}>
              {(run) => (
                <>
                  <tr
                    class="group cursor-pointer"
                    classList={{
                      highlight: props.opened?.instanceId === run.instanceId,
                    }}
                    onClick={() => props.onPick(run)}
                  >
                    <td class="tabular-nums">{stamp(run.startedAt)}</td>
                    <td class="num">{duration(run.durationSeconds)}</td>
                    <td class="num">{run.kills}</td>
                    <td class="num">{run.assists}</td>
                    <td class="num">{run.deaths}</td>
                    <td class="num">{ratio(run)}</td>
                    <td class="num">{score(run.score)}</td>
                    <Result completed={run.completed} />
                    <Chevron
                      open={props.opened?.instanceId === run.instanceId}
                    />
                  </tr>

                  <Show when={props.opened?.instanceId === run.instanceId}>
                    <tr class="report">
                      <td colspan={9} class="bg-panel-raised">
                        <Show when={props.reportLoading}>
                          <p class="m-0 text-muted">Loading report…</p>
                        </Show>
                        <Show when={props.reportFailed}>
                          <p class="m-0 text-danger">Report failed to load.</p>
                        </Show>
                        <Show when={props.report}>
                          {(loaded) => (
                            <Report
                              report={loaded()}
                              tables={props.tables}
                              characterId={run.characterId}
                            />
                          )}
                        </Show>
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  </>
);
