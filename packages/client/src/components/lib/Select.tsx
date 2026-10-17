import { For, Show, type JSX } from "solid-js";

import { cn } from "./cn.ts";
import { NativeSelect } from "./zaidan/native-select.tsx";

const ALL = "";

interface SharedProps<T extends string> {
  label: string;
  options: readonly T[];
  names: Record<T, string>;
  class?: string;
  children?: JSX.Element;
}

interface PickProps<T extends string> extends SharedProps<T> {
  all?: false;
  value: T;
  onChange: (value: T) => void;
}

interface AllProps<T extends string> extends SharedProps<T> {
  all: true;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}

/** A labeled native select; all adds a leading "All" option for undefined */
export const Select = <T extends string>(
  props: PickProps<T> | AllProps<T>,
) => (
  <label
    class={cn("flex items-center gap-2 text-muted-foreground", props.class)}
  >
    {props.label}
    <NativeSelect
      class="text-foreground"
      value={props.value ?? ALL}
      onChange={(event) => {
        const value = event.currentTarget.value as T;

        if (props.all) {
          props.onChange(value === ALL ? undefined : value);

          return;
        }

        props.onChange(value);
      }}
    >
      <Show when={props.all}>
        <option value={ALL}>All</option>
      </Show>
      <For each={props.options}>
        {(option) => <option value={option}>{props.names[option]}</option>}
      </For>
      {props.children}
    </NativeSelect>
  </label>
);
