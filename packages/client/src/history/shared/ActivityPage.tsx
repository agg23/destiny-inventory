import type { DestinyPostGameCarnageReportData } from "bungie-api-ts/destiny2";
import { For, Show } from "solid-js";

import {
  HEADING,
  HEADING_NOTE,
  HERO,
  SECTION,
  TABLE_FRAME,
  TABLE_HEADER,
} from "../../components/lib/text.ts";
import { NativeSelect } from "../../components/lib/zaidan/native-select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import {
  tileArt,
  type ActivityTables,
} from "../../core/activities/activities.ts";
import { duration, type HistoryRun } from "../../core/activities/history.ts";
import { Chevron, Result } from "./ActivityRow.tsx";
import { ratio, rungColor, score, stamp } from "./runFormat.ts";
import { METRICS, RunGraph, type Metric } from "./RunGraph.tsx";
import { Report } from "./RunReport.tsx";
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
    <div class="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div
        class={HERO}
        style={{ "--art": tileArt(props.art, props.typeName) }}
      >
        <h2 class="text-2xl leading-tight font-semibold">
          {props.label}
          <Show when={props.difficulty}>
            {(rung) => <span class={rungColor(rung())}>: {rung()}</span>}
          </Show>
        </h2>
        <span class="text-foreground/80">{props.typeName}</span>
        <span class="mt-2 flex flex-wrap justify-center gap-x-5 tabular-nums">
          <span>
            <b>{props.best.runs}</b>{" "}
            <span class="text-muted-foreground">entered</span>
          </span>
          <span>
            <b>{props.best.cleared}</b>{" "}
            <span class="text-muted-foreground">cleared</span>
          </span>
          <Show when={props.best.fastest !== undefined}>
            <span>
              <b>{duration(props.best.fastest ?? 0)}</b>{" "}
              <span class="text-muted-foreground">fastest</span>
            </span>
          </Show>
          <Show when={props.best.score > 0}>
            <span>
              <b>{props.best.score.toLocaleString()}</b>{" "}
              <span class="text-muted-foreground">best score</span>
            </span>
          </Show>
        </span>
      </div>

      <Show when={props.oldestFirst.length > 1}>
        <div class="flex flex-col gap-3 p-4">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p class={`${HEADING} m-0 flex-1`}>Historical performance</p>
            <label class="flex items-center gap-2 text-muted-foreground">
              Comparing
              <NativeSelect
                class="text-foreground"
                value={props.metric.id}
                onChange={(event) => props.onMetric(event.currentTarget.value)}
              >
                <For each={METRICS}>
                  {(one) => <option value={one.id}>{one.label}</option>}
                </For>
              </NativeSelect>
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

    <section class={SECTION}>
      <h2 class={`${HEADING} flex items-baseline gap-2`}>
        Runs
        <span class={HEADING_NOTE}>
          Newest first · pick one for its full report
        </span>
      </h2>
      <div class={TABLE_FRAME}>
        <Table>
          <TableHeader class={TABLE_HEADER}>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead class="text-right tabular-nums">Duration</TableHead>
              <TableHead class="text-right tabular-nums">Kills</TableHead>
              <TableHead class="text-right tabular-nums">Assists</TableHead>
              <TableHead class="text-right tabular-nums">Deaths</TableHead>
              <TableHead class="text-right tabular-nums">K/D</TableHead>
              <TableHead class="text-right tabular-nums">Score</TableHead>
              <TableHead>Result</TableHead>
              <TableHead class="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={props.newestFirst}>
              {(run) => (
                <>
                  <TableRow
                    class="group cursor-pointer"
                    data-state={
                      props.opened?.instanceId === run.instanceId
                        ? "selected"
                        : undefined
                    }
                    onClick={() => props.onPick(run)}
                  >
                    <TableCell class="tabular-nums">
                      {stamp(run.startedAt)}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {duration(run.durationSeconds)}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {run.kills}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {run.assists}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {run.deaths}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {ratio(run)}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {score(run.score)}
                    </TableCell>
                    <Result completed={run.completed} />
                    <Chevron
                      open={props.opened?.instanceId === run.instanceId}
                    />
                  </TableRow>

                  <Show when={props.opened?.instanceId === run.instanceId}>
                    <TableRow class="hover:bg-transparent">
                      <TableCell
                        colSpan={9}
                        class="bg-popover p-4 whitespace-normal"
                      >
                        <Show when={props.reportLoading}>
                          <p class="text-muted-foreground">
                            Loading report…
                          </p>
                        </Show>
                        <Show when={props.reportFailed}>
                          <p class="text-destructive">
                            Report failed to load.
                          </p>
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
                      </TableCell>
                    </TableRow>
                  </Show>
                </>
              )}
            </For>
          </TableBody>
        </Table>
      </div>
    </section>
  </>
);
