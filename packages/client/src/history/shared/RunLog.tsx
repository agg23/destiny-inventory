import { For } from "solid-js";

import { TABLE_FRAME, TABLE_HEADER } from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import {
  duration,
  playedSeconds,
  span,
  type HistoryRun,
} from "../../core/activities/history.ts";
import { Chevron, Plate, Result, type PlateProps } from "./ActivityRow.tsx";
import type { Day } from "./groups.ts";
import { clock, dayTitle, plural, score } from "./runFormat.ts";

const NUMBER = "text-right tabular-nums";

export const RunLog = (props: {
  days: Day[];
  plateOf: (run: HistoryRun) => PlateProps;
  onOpen: (run: HistoryRun) => void;
}) => (
  <div class={TABLE_FRAME}>
    <Table class="table-fixed">
      <TableHeader class={TABLE_HEADER}>
        <TableRow>
          <TableHead>Activity</TableHead>
          <TableHead class={`${NUMBER} w-28`}>Started</TableHead>
          <TableHead class={`${NUMBER} w-28`}>Duration</TableHead>
          <TableHead class={`${NUMBER} w-24`}>Kills</TableHead>
          <TableHead class={`${NUMBER} w-24`}>Deaths</TableHead>
          <TableHead class={`${NUMBER} w-28`}>Score</TableHead>
          <TableHead class="w-32">Result</TableHead>
          <TableHead class="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <For each={props.days}>
          {(day) => (
            <>
              <TableRow class="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={8} class="py-1.5">
                  <span class="flex items-baseline gap-2 text-xs">
                    <span class="font-medium text-foreground">
                      {dayTitle(day.day)}
                    </span>
                    <span class="text-muted-foreground tabular-nums">
                      {plural(day.runs.length, "run")} ·{" "}
                      {span(playedSeconds(day.runs))}
                    </span>
                  </span>
                </TableCell>
              </TableRow>
              <For each={day.runs}>
                {(run) => (
                  <TableRow
                    class="group cursor-pointer"
                    onClick={() => props.onOpen(run)}
                  >
                    <TableCell>
                      <Plate {...props.plateOf(run)} />
                    </TableCell>
                    <TableCell class={NUMBER}>{clock(run.startedAt)}</TableCell>
                    <TableCell class={NUMBER}>
                      {duration(run.durationSeconds)}
                    </TableCell>
                    <TableCell class={NUMBER}>{run.kills}</TableCell>
                    <TableCell class={NUMBER}>{run.deaths}</TableCell>
                    <TableCell class={NUMBER}>{score(run.score)}</TableCell>
                    <Result completed={run.completed} />
                    <Chevron />
                  </TableRow>
                )}
              </For>
            </>
          )}
        </For>
      </TableBody>
    </Table>
  </div>
);
