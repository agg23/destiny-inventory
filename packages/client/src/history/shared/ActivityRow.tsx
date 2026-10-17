import { Show, type JSX } from "solid-js";

import { TableCell } from "../../components/lib/zaidan/table.tsx";
import type { PlateProps } from "../../core/activities/activityLookup.ts";
import { tileArt } from "../../core/activities/art.ts";
import { rungColor } from "./runFormat.ts";

export const Difficulty = (props: { name: string | undefined }) => (
  <Show when={props.name}>
    {(name) => <span class={rungColor(name())}>{name()}</span>}
  </Show>
);

interface Props extends Pick<PlateProps, "name" | "art" | "typeName"> {
  difficulty?: string;
  note?: string;
  badge?: () => JSX.Element;
  subline?: JSX.Element;
}

export const Plate = (props: Props) => (
  <div class="flex min-w-0 items-center gap-3">
    <span
      class="h-8 w-14 shrink-0 rounded-sm bg-cover bg-center"
      style={{ "background-image": tileArt(props.art, props.typeName) }}
    />
    <div class="flex min-w-0 flex-col">
      <Show
        when={props.badge}
        fallback={<span class="truncate text-foreground">{props.name}</span>}
      >
        {(badge) => (
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate text-foreground">{props.name}</span>
            {badge()()}
          </span>
        )}
      </Show>
      {props.subline ?? (
        <span class="flex items-baseline gap-1.5 overflow-hidden text-xs text-muted-foreground">
          <Difficulty name={props.difficulty} />
          <Show when={props.difficulty && props.note}>
            <span>·</span>
          </Show>
          <span class="truncate">{props.note}</span>
        </span>
      )}
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
