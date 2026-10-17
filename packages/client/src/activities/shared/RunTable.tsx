import { For } from "solid-js";

import { GroupRow } from "../../components/GroupRow.tsx";
import { TABLE_FRAME, TABLE_HEADER } from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import type { Available } from "../../core/activities/types.ts";
import type { Data } from "./activityData.ts";
import { Row } from "./ActivityRow.tsx";

export interface Section {
  name: string;
  entries: Available[];
}

const COLUMNS: { name: string; width: string }[] = [
  { name: "Activity", width: "" },
  { name: "Difficulty", width: "w-24" },
  { name: "Power", width: "w-24" },
  { name: "Drops", width: "w-32" },
  { name: "Rewards", width: "w-72" },
  { name: "Challenges", width: "w-24" },
  { name: "Last run", width: "w-32" },
];

interface TableProps {
  data: Data;
  sections: Section[];
}

export const RunTable = (props: TableProps) => (
  <div class={TABLE_FRAME}>
    <Table class="table-fixed">
      <TableHeader class={TABLE_HEADER}>
        <TableRow>
          <For each={COLUMNS}>
            {(column) => (
              <TableHead class={column.width}>{column.name}</TableHead>
            )}
          </For>
        </TableRow>
      </TableHeader>
      <TableBody>
        <For each={props.sections}>
          {(section) => (
            <>
              <GroupRow
                colSpan={COLUMNS.length}
                class="hover:bg-transparent"
                title={section.name}
                note={section.entries.length}
              />
              <For each={section.entries}>
                {(entry) => <Row data={props.data} entry={entry} />}
              </For>
            </>
          )}
        </For>
      </TableBody>
    </Table>
  </div>
);
