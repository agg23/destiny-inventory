import { For, type JSX } from "solid-js";

import { cn } from "./cn.ts";
import { PICK_OPTION, PICK_TRACK } from "./text.ts";
import { ToggleGroup, ToggleGroupItem } from "./zaidan/toggle-group.tsx";

interface Props<T extends string> {
  value: T | undefined;
  options: readonly T[];
  label: (option: T) => JSX.Element;
  disabled?: (option: T) => string | undefined;
  size?: "sm" | "default";
  class?: string;
  onChange: (value: T) => void;
}

/** Single select filter where every option is one click, and one is always picked */
export const PickOne = <T extends string>(props: Props<T>) => (
  <ToggleGroup
    size={props.size}
    spacing={0.5}
    class={cn("shrink-0", PICK_TRACK, props.class)}
    value={props.value ?? null}
    onChange={(next: string | null) => {
      // Kobalte reports a click on the picked option as null
      if (next === null) {
        if (props.value !== undefined) {
          props.onChange(props.value);
        }

        return;
      }

      props.onChange(next as T);
    }}
  >
    <For each={props.options}>
      {(option) => (
        <ToggleGroupItem
          value={option}
          class={cn(PICK_OPTION, props.size === "sm" ? "h-6" : "h-7")}
          disabled={!!props.disabled?.(option)}
          title={props.disabled?.(option)}
        >
          <span class="grid">
            {/* Holds the semibold width */}
            <span
              class="invisible col-start-1 row-start-1 inline-flex items-center gap-1.5 font-semibold"
              aria-hidden="true"
            >
              {props.label(option)}
            </span>
            <span class="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5">
              {props.label(option)}
            </span>
          </span>
        </ToggleGroupItem>
      )}
    </For>
  </ToggleGroup>
);
