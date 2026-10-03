import { For, Show } from "solid-js";

const ALL = "";

export const Choice = <T extends string>(props: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  all?: boolean;
  onChoose: (value: T | undefined) => void;
}) => (
  <label class="flex items-center gap-2 text-sm text-dim">
    {props.label}
    <select
      class="select small"
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
    </select>
  </label>
);
