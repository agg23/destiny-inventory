import type { DestinyPostGameCarnageReportData } from "bungie-api-ts/destiny2";
import { For, Show } from "solid-js";

import { Heading } from "../../components/Heading.tsx";
import { Hero } from "../../components/Hero.tsx";
import { Select } from "../../components/lib/Select.tsx";
import {
  HEADING,
  SECTION,
  TABLE_FRAME,
  TABLE_HEADER,
} from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { NUMBER, NumCell } from "../../components/NumCell.tsx";
import type { HistoryRun } from "../../core/activities/history.ts";
import type { ActivityTables } from "../../core/activities/types.ts";
import { dateTime, duration } from "../../core/time.ts";
import { Chevron, Result } from "./ActivityRow.tsx";
import { ratio, rungColor, score } from "./runFormat.ts";
import { METRICS, RunGraph, type Metric } from "./RunGraph.tsx";
import { Report } from "./RunReport.tsx";
import type { Best } from "./totals.ts";

const METRIC_NAMES = Object.fromEntries(
  METRICS.map((one) => [one.id, one.label]),
);

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
      <Hero
        art={props.art}
        typeName={props.typeName}
        title={
          <>
            {props.label}
            <Show when={props.difficulty}>
              {(rung) => <span class={rungColor(rung())}>: {rung()}</span>}
            </Show>
          </>
        }
      >
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
      </Hero>

      <Show when={props.oldestFirst.length > 1}>
        <div class="flex flex-col gap-3 p-4">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p class={`${HEADING} m-0 flex-1`}>Historical performance</p>
            <Select
              label="Comparing"
              value={props.metric.id}
              options={METRICS.map((one) => one.id)}
              names={METRIC_NAMES}
              onChange={props.onMetric}
            />
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
      <Heading note="Newest first · pick one for its full report">Runs</Heading>
      <div class={TABLE_FRAME}>
        <Table>
          <TableHeader class={TABLE_HEADER}>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead class={NUMBER}>Duration</TableHead>
              <TableHead class={NUMBER}>Kills</TableHead>
              <TableHead class={NUMBER}>Assists</TableHead>
              <TableHead class={NUMBER}>Deaths</TableHead>
              <TableHead class={NUMBER}>K/D</TableHead>
              <TableHead class={NUMBER}>Score</TableHead>
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
                      {dateTime(run.startedAt)}
                    </TableCell>
                    <NumCell>{duration(run.durationSeconds)}</NumCell>
                    <NumCell>{run.kills}</NumCell>
                    <NumCell>{run.assists}</NumCell>
                    <NumCell>{run.deaths}</NumCell>
                    <NumCell>{ratio(run)}</NumCell>
                    <NumCell>{score(run.score)}</NumCell>
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
