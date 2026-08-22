import { Show } from "solid-js";

import { tileArt } from "../activities.ts";
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
    {(name) => (
      <span class={`uppercase text-sm tracking-[0.12em] ${rungColor(name())}`}>
        {name()}
      </span>
    )}
  </Show>
);

export const Plate = (props: PlateProps) => (
  <div
    class="plate flex h-20 flex-col justify-center gap-0.5 px-3"
    style={{ "--art": tileArt(props.art, props.typeName) }}
  >
    <span class="line-clamp-2 text-md text-fg">{props.name}</span>
    <span class="flex items-baseline gap-2 overflow-hidden text-sm text-text">
      <Difficulty name={props.difficulty} />
      <span class="truncate">{props.note}</span>
    </span>
  </div>
);

export const Result = (props: { completed: boolean }) => (
  <td
    class="text-sm uppercase"
    classList={{
      "text-dim": props.completed,
      "text-warning": !props.completed,
    }}
  >
    {props.completed ? "Cleared" : "Incomplete"}
  </td>
);

export const Chevron = (props: { open?: boolean }) => (
  <td class="w-8 text-center text-lg text-dim group-hover:text-fg">
    {props.open ? "▾" : "›"}
  </td>
);
