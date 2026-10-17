import { For, Show, type JSX } from "solid-js";

import { HEADING, SECTION, TABLE_FRAME } from "./lib/text.ts";
import { Table, TableBody } from "./lib/zaidan/table.tsx";

interface Props<T> {
  title: string;
  each: T[];
  empty?: string;
  children: (item: T) => JSX.Element;
}

/** A titled table; renders nothing when empty unless given empty text */
export const TableSection = <T,>(props: Props<T>) => (
  <Show when={props.each.length > 0 || props.empty !== undefined}>
    <section class={SECTION}>
      <h2 class={HEADING}>{props.title}</h2>
      <Show
        when={props.each.length > 0}
        fallback={<p class="text-muted-foreground">{props.empty}</p>}
      >
        <div class={TABLE_FRAME}>
          <Table>
            <TableBody>
              <For each={props.each}>{props.children}</For>
            </TableBody>
          </Table>
        </div>
      </Show>
    </section>
  </Show>
);
