import { For, type JSX } from "solid-js";

import { ToggleGroup, ToggleGroupItem } from "./zaidan/toggle-group.tsx";

interface Props<T extends string> {
  value: T | undefined;
  options: readonly T[];
  label: (option: T) => JSX.Element;
  disabled?: (option: T) => string | undefined;
  onChange: (value: T) => void;
}

/** Single select filter where every option is one click, and one is always picked */
export const PickOne = <T extends string>(props: Props<T>) => (
  <ToggleGroup
    variant="outline"
    class="shrink-0"
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
          class="gap-1.5"
          disabled={!!props.disabled?.(option)}
          title={props.disabled?.(option)}
        >
          {props.label(option)}
        </ToggleGroupItem>
      )}
    </For>
  </ToggleGroup>
);
