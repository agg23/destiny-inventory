import type { JSX } from "solid-js";

import { cn } from "./cn.ts";
import { Checkbox as Box } from "./zaidan/checkbox.tsx";

interface Props {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  class?: string;
  onChange: (checked: boolean) => void;
  children: JSX.Element;
}

export const Checkbox = (props: Props) => (
  <label
    class={cn(
      "inline-flex cursor-pointer items-center gap-2 select-none has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50",
      props.class,
    )}
  >
    <Box
      checked={props.checked}
      indeterminate={props.indeterminate}
      disabled={props.disabled}
      onChange={props.onChange}
    />
    {props.children}
  </label>
);
