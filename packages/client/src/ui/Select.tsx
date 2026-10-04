import { For } from "solid-js";

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  names: Record<T, string>;
  onChange: (value: T) => void;
}

export const Select = <T extends string>(props: Props<T>) => (
  <label class="setting-select">
    <span class="section-label">{props.label}</span>
    <select
      class="select block"
      value={props.value}
      onChange={(e) => props.onChange(e.currentTarget.value as T)}
    >
      <For each={props.options}>
        {(option) => <option value={option}>{props.names[option]}</option>}
      </For>
    </select>
  </label>
);
