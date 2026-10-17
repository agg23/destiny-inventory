import type { JSX } from "solid-js";

import { cn } from "./lib/cn.ts";
import { TableCell, TableRow } from "./lib/zaidan/table.tsx";

interface Props {
  colSpan: number;
  title: JSX.Element;
  note: JSX.Element;
  class: string;
}

/** A full-width row heading a group of table rows */
export const GroupRow = (props: Props) => (
  <TableRow class={cn("bg-muted/30", props.class)}>
    <TableCell colSpan={props.colSpan} class="py-1.5">
      <span class="flex items-baseline gap-2 text-xs">
        <span class="font-medium text-foreground">{props.title}</span>
        <span class="text-muted-foreground tabular-nums">{props.note}</span>
      </span>
    </TableCell>
  </TableRow>
);
