import { For, Show } from "solid-js";

import {
  HEADING,
  HEADING_NOTE,
  SECTION,
  TABLE_FRAME,
  TABLE_HEADER,
} from "../../components/lib/text.ts";
import { Button } from "../../components/lib/zaidan/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import {
  ago,
  duration,
  span,
  type ActivityRow,
  type BucketGroup,
} from "../../core/activities/history.ts";
import { Chevron, Plate, type PlateProps } from "./ActivityRow.tsx";
import { score } from "./runFormat.ts";

const SERIES_ROWS = 10;

const NUMBER = "text-right tabular-nums";

export const ActivitySeries = (props: {
  groups: BucketGroup[];
  plateOf: (row: ActivityRow) => PlateProps;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOpen: (row: ActivityRow) => void;
}) => {
  const rowsOf = (group: BucketGroup): ActivityRow[] =>
    props.isExpanded(group.bucket.id)
      ? group.rows
      : group.rows.slice(0, SERIES_ROWS);

  return (
    <div class="flex flex-col gap-6">
      <For each={props.groups}>
        {(group) => (
          <section class={SECTION}>
            <h2 class={`${HEADING} flex items-baseline gap-2`}>
              {group.bucket.name}
              <span class={HEADING_NOTE}>
                {group.runs} entered · {group.cleared} cleared ·{" "}
                {group.deathless} deathless · {span(group.playedSeconds)}
              </span>
            </h2>
            <div class={TABLE_FRAME}>
              <Table class="table-fixed">
                <TableHeader class={TABLE_HEADER}>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead class={`${NUMBER} w-28`}>Entered</TableHead>
                    <TableHead class={`${NUMBER} w-28`}>Cleared</TableHead>
                    <TableHead class={`${NUMBER} w-28`}>Fastest</TableHead>
                    <TableHead class={`${NUMBER} w-32`}>Best score</TableHead>
                    <TableHead class={`${NUMBER} w-32`}>Last</TableHead>
                    <TableHead class="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={rowsOf(group)}>
                    {(row) => (
                      <TableRow
                        class="group cursor-pointer"
                        onClick={() => props.onOpen(row)}
                      >
                        <TableCell>
                          <Plate {...props.plateOf(row)} />
                        </TableCell>
                        <TableCell class={NUMBER}>{row.runs}</TableCell>
                        <TableCell class={NUMBER}>{row.cleared}</TableCell>
                        <TableCell class={NUMBER}>
                          {row.fastestSeconds === undefined
                            ? "-"
                            : duration(row.fastestSeconds)}
                        </TableCell>
                        <TableCell class={NUMBER}>
                          {score(row.bestScore)}
                        </TableCell>
                        <TableCell class={NUMBER}>
                          {ago(row.lastRunAt)}
                        </TableCell>
                        <Chevron />
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
            <Show when={group.rows.length > SERIES_ROWS}>
              <Button
                size="sm"
                variant="ghost"
                class="self-start"
                aria-pressed={props.isExpanded(group.bucket.id)}
                onClick={() => props.onToggle(group.bucket.id)}
              >
                {props.isExpanded(group.bucket.id)
                  ? `Show top ${SERIES_ROWS}`
                  : `Show all ${group.rows.length}`}
              </Button>
            </Show>
          </section>
        )}
      </For>
    </div>
  );
};
