import type { JSX } from "solid-js";

import { cn } from "./cn.ts";

export const Progress = (props: { value: number; class?: string }) => (
  <span
    class={cn("block h-1 overflow-hidden rounded-full bg-muted", props.class)}
  >
    <span
      class="block h-full bg-primary"
      style={{ width: `${Math.max(0, Math.min(1, props.value)) * 100}%` }}
    />
  </span>
);

/** A labeled count over its bar, the way the game draws objectives */
export const Objective = (props: {
  label: JSX.Element;
  progress: number;
  goal: number;
  class?: string;
}) => (
  <div class={cn("flex min-w-0 flex-col gap-1", props.class)}>
    <span class="flex justify-between gap-2">
      <span class="truncate text-muted-foreground">{props.label}</span>
      <span class="shrink-0 tabular-nums">
        {props.progress.toLocaleString()}/{props.goal.toLocaleString()}
      </span>
    </span>
    <Progress value={props.progress / Math.max(1, props.goal)} />
  </div>
);
