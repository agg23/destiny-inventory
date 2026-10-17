import { For } from "solid-js";

import { GroupRow } from "../../components/GroupRow.tsx";
import { TABLE_FRAME, TABLE_HEADER } from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { NUMBER, NumCell } from "../../components/NumCell.tsx";
import type { PlateProps } from "../../core/activities/activityLookup.ts";
import {
  playedSeconds,
  type HistoryRun,
} from "../../core/activities/history.ts";
import { plural } from "../../core/text.ts";
import { dayTitle, duration, shortTime, span } from "../../core/time.ts";
import { Chevron, Plate, Result } from "./ActivityRow.tsx";
import type { Day } from "./groups.ts";
import { score } from "./runFormat.ts";

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
              <GroupRow
                colSpan={8}
                class="hover:bg-muted/30"
                title={dayTitle(day.day)}
                note={`${plural(day.runs.length, "run")} · ${span(playedSeconds(day.runs))}`}
              />
              <For each={day.runs}>
                {(run) => (
                  <TableRow
                    class="group cursor-pointer"
                    onClick={() => props.onOpen(run)}
                  >
                    <TableCell>
                      <Plate {...props.plateOf(run)} />
                    </TableCell>
                    <NumCell>{shortTime(run.startedAt)}</NumCell>
                    <NumCell>{duration(run.durationSeconds)}</NumCell>
                    <NumCell>{run.kills}</NumCell>
                    <NumCell>{run.deaths}</NumCell>
                    <NumCell>{score(run.score)}</NumCell>
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
