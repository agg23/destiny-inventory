import { splitProps, type ComponentProps } from "solid-js";

import { cn } from "./lib/cn.ts";
import { TableCell } from "./lib/zaidan/table.tsx";

/** Right-aligned tabular figures, for number columns */
export const NUMBER = "text-right tabular-nums";

export const NumCell = (props: ComponentProps<typeof TableCell>) => {
  const [local, others] = splitProps(props, ["class"]);

  return <TableCell class={cn(NUMBER, local.class)} {...others} />;
};
