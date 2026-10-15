import { For } from "solid-js";

import { cn } from "./cn.ts";
import { NativeSelect } from "./zaidan/native-select.tsx";

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  names: Record<T, string>;
  class?: string;
  onChange: (value: T) => void;
}

export const Select = <T extends string>(props: Props<T>) => (
  <label
    class={cn("flex items-center gap-2 text-muted-foreground", props.class)}
  >
    {props.label}
    <NativeSelect
      class="text-foreground"
      value={props.value}
      onChange={(e) => props.onChange(e.currentTarget.value as T)}
    >
      <For each={props.options}>
        {(option) => <option value={option}>{props.names[option]}</option>}
      </For>
    </NativeSelect>
  </label>
);
