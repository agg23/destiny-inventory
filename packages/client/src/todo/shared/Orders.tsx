import { Show } from "solid-js";

import { BungieImage } from "../../components/BungieImage.tsx";
import { Countdown } from "../../components/Countdown.tsx";
import { cn } from "../../components/lib/cn.ts";
import { Progress } from "../../components/lib/Progress.tsx";
import { CARD } from "../../components/lib/text.ts";
import { TableCell, TableRow } from "../../components/lib/zaidan/table.tsx";
import { NumCell } from "../../components/NumCell.tsx";
import { TableSection } from "../../components/TableSection.tsx";
import { readable } from "../../core/activities/activities.ts";
import { fullDateTime, HOUR, shortDay } from "../../core/time.ts";
import type { Claimed, Order } from "../../core/todo/orders.ts";

// Only these two rarities get an accent stripe in game
const ACCENTS: Record<string, string> = {
  Legendary:
    "border-l-3 border-l-[color-mix(in_srgb,var(--legendary),#fff_20%)]",
  Exotic: "border-l-3 border-l-exotic",
};

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
      <BungieImage
        path={props.order.icon}
        class="size-(--icon-sm) shrink-0 object-contain"
      />
      <span class="min-w-0 flex-1 font-medium">{props.order.name}</span>
      <Show
        when={props.order.expiresAt !== undefined}
        fallback={<span class="text-muted-foreground">No deadline</span>}
      >
        <Countdown
          at={props.order.expiresAt ?? 0}
          now={props.now}
          label="Expires"
          left={false}
          class={cn(
            "whitespace-nowrap tabular-nums",
            (props.order.expiresAt ?? 0) - props.now < HOUR && "text-warning",
          )}
        />
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
  <TableSection
    title="Completed orders"
    each={props.log}
    empty="Nothing claimed while the app was open"
  >
    {(entry) => (
      <TableRow>
        <TableCell class="w-2/5">{entry.name}</TableCell>
        <TableCell class="text-muted-foreground">{entry.family}</TableCell>
        <NumCell title={`Claimed ${fullDateTime(entry.claimedAt)}`}>
          {shortDay(entry.claimedAt)}
        </NumCell>
      </TableRow>
    )}
  </TableSection>
);
