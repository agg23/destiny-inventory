import { Show } from "solid-js";

import { TableCell } from "../../components/lib/zaidan/table.tsx";
import { tileArt } from "../../core/activities/art.ts";
import { rungColor } from "./runFormat.ts";

export interface PlateProps {
  name: string;
  art: string | undefined;
  typeName: string | undefined;
  difficulty: string | undefined;
  note: string | undefined;
}

export const Difficulty = (props: { name: string | undefined }) => (
  <Show when={props.name}>
    {(name) => <span class={rungColor(name())}>{name()}</span>}
  </Show>
);

export const Plate = (props: PlateProps) => (
  <div class="flex min-w-0 items-center gap-3">
    <span
      class="h-8 w-14 shrink-0 rounded-sm bg-cover bg-center"
      style={{ "background-image": tileArt(props.art, props.typeName) }}
    />
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-foreground">{props.name}</span>
      <span class="flex items-baseline gap-1.5 overflow-hidden text-xs text-muted-foreground">
        <Difficulty name={props.difficulty} />
        <Show when={props.difficulty && props.note}>
          <span>·</span>
        </Show>
        <span class="truncate">{props.note}</span>
      </span>
    </div>
  </div>
);

export const Result = (props: { completed: boolean }) => (
  <TableCell
    classList={{
      "text-muted-foreground": props.completed,
      "text-warning": !props.completed,
    }}
  >
    {props.completed ? "Cleared" : "Incomplete"}
  </TableCell>
);

export const Chevron = (props: { open?: boolean }) => (
  <TableCell class="w-8 text-center text-lg text-muted-foreground group-hover:text-foreground">
    {props.open ? "▾" : "›"}
  </TableCell>
);
