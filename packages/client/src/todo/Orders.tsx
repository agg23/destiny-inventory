import { For, Show } from "solid-js";

import { readable } from "../activities.ts";
import { BUNGIE } from "../bungie.ts";
import type { Claimed, Order } from "../orders.ts";
import { remaining } from "../reset.ts";
import { Progress } from "../ui/Progress.tsx";
import { CARD, HEADING, SECTION, TABLE_FRAME } from "../ui/text.ts";
import { Table, TableBody, TableCell, TableRow } from "../ui/zaidan/table.tsx";
import { day, exact } from "./todoFormat.ts";

// Only these two rarities get an accent stripe in game
const ACCENTS: Record<string, string> = {
  Legendary:
    "border-l-3 border-l-[color-mix(in_srgb,var(--legendary),#fff_20%)]",
  Exotic: "border-l-3 border-l-exotic",
};

const HOUR = 3_600_000;

export const OrderCard = (props: {
  order: Order;
  now: number;
  values: Record<number, number>;
}) => (
  <div
    class={`${CARD} ${ACCENTS[props.order.rarity] ?? ""}`}
    data-rarity={props.order.rarity}
  >
    <div class="flex items-center gap-2">
      <img
        class="size-(--icon-sm) shrink-0 object-contain"
        src={`${BUNGIE}${props.order.icon}`}
        alt=""
      />
      <span class="min-w-0 flex-1 font-medium">{props.order.name}</span>
      <Show
        when={props.order.expiresAt !== undefined}
        fallback={<span class="text-muted-foreground">No deadline</span>}
      >
        <span
          class="whitespace-nowrap tabular-nums"
          classList={{
            "text-warning": (props.order.expiresAt ?? 0) - props.now < HOUR,
          }}
          title={`Expires ${exact(props.order.expiresAt ?? 0)}`}
        >
          {remaining((props.order.expiresAt ?? 0) - props.now)}
        </span>
      </Show>
    </div>
    <div class="flex justify-between gap-2 text-xs">
      <span class={`text-${props.order.rarity.toLowerCase()}`}>
        {props.order.rarity}
      </span>
      <span class="text-muted-foreground">{props.order.family}</span>
    </div>
    <Show when={props.order.description}>
      <p class="text-xs text-muted-foreground">
        {readable(props.order.description, props.values)}
      </p>
    </Show>
    <Progress value={props.order.progress / Math.max(1, props.order.goal)} />
    <Show when={props.order.readout}>
      <div class="flex justify-between gap-2 text-xs text-muted-foreground">
        <span
          class="tabular-nums"
          title={`${props.order.progress.toLocaleString()} / ${props.order.goal.toLocaleString()} points`}
        >
          {props.order.readout}
        </span>
      </div>
    </Show>
  </div>
);

export const ClaimedLog = (props: { log: Claimed[] }) => (
  <section class={SECTION}>
    <h2 class={HEADING}>Completed orders</h2>
    <Show
      when={props.log.length > 0}
      fallback={
        <p class="text-muted-foreground">
          Nothing claimed while the app was open
        </p>
      }
    >
      <div class={TABLE_FRAME}>
        <Table>
          <TableBody>
            <For each={props.log}>
              {(entry) => (
                <TableRow>
                  <TableCell class="w-2/5">{entry.name}</TableCell>
                  <TableCell class="text-muted-foreground">
                    {entry.family}
                  </TableCell>
                  <TableCell
                    class="text-right tabular-nums"
                    title={`Claimed ${exact(entry.claimedAt)}`}
                  >
                    {day(entry.claimedAt)}
                  </TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </div>
    </Show>
  </section>
);
