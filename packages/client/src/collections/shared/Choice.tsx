import { For, Show } from "solid-js";

import { NativeSelect } from "../../components/lib/zaidan/native-select.tsx";

const ALL = "";

export const Choice = <T extends string>(props: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  all?: boolean;
  onChoose: (value: T | undefined) => void;
}) => (
  <label class="flex items-center gap-2 text-muted-foreground">
    {props.label}
    <NativeSelect
      class="text-foreground"
      value={props.value ?? ALL}
      onChange={(event) => {
        const value = event.currentTarget.value;

        props.onChoose(value === ALL ? undefined : (value as T));
      }}
    >
      <Show when={props.all ?? true}>
        <option value={ALL}>All</option>
      </Show>
      <For each={props.options}>
        {(option) => <option value={option}>{props.labels[option]}</option>}
      </For>
    </NativeSelect>
  </label>
);
