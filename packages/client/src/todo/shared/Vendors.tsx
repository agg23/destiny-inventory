import type { DimItem } from "app/inventory/item-types";
import { For, Match, Show, Switch } from "solid-js";

import { ItemTile } from "../../components/ItemTile.tsx";
import {
  HEADING,
  HEADING_NOTE,
  LABEL,
  SECTION,
  TABLE_FRAME,
} from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { readable } from "../../core/activities/activities.ts";
import { BUNGIE } from "../../core/api/bungie.ts";
import { tileKey } from "../../core/profile/fakeItems.ts";
import { nextDailyReset, remaining } from "../../core/todo/reset.ts";
import { visitEndsAt } from "../../core/todo/vendors.ts";
import type { Offer, Slot, VendorState } from "../../core/todo/vendorTypes.ts";
import { exact } from "./todoFormat.ts";

const OfferRow = (props: { offer: Offer; now: number }) => (
  <TableRow
    classList={{
      "text-muted-foreground":
        !props.offer.available && props.offer.pursuit?.kind !== "held",
    }}
  >
    <TableCell class="w-2/5">
      <span class="flex min-w-0 items-center gap-2">
        <Show when={props.offer.icon}>
          {(icon) => (
            <img
              class="size-(--icon-sm) shrink-0 object-contain"
              src={`${BUNGIE}${icon()}`}
              alt=""
            />
          )}
        </Show>
        {props.offer.name}
        <Show when={props.offer.quantity > 1}>
          <span class="text-muted-foreground">x{props.offer.quantity}</span>
        </Show>
      </span>
    </TableCell>
    <TableCell>
      <Switch fallback={<span class="text-good">Available</span>}>
        <Match
          when={
            props.offer.pursuit?.kind === "held"
              ? props.offer.pursuit
              : undefined
          }
        >
          {(held) => (
            <span class="tabular-nums">In Progress {held().progress}</span>
          )}
        </Match>
        <Match when={props.offer.pursuit?.kind === "completed"}>
          Completed
        </Match>
        <Match when={props.offer.reasons.length > 0}>
          <span class="text-warning">{props.offer.reasons.join(" · ")}</span>
        </Match>
      </Switch>
    </TableCell>
    <TableCell class="text-right tabular-nums">
      <Show
        when={
          props.offer.pursuit?.kind === "held"
            ? props.offer.pursuit.expiresAt
            : undefined
        }
        fallback={
          <For each={props.offer.costs}>
            {(cost) => (
              <>
                {cost.quantity.toLocaleString()} {cost.name}
              </>
            )}
          </For>
        }
      >
        {(at) => (
          <span class="text-muted-foreground" title={`Expires ${exact(at())}`}>
            {remaining(at() - props.now)} left
          </span>
        )}
      </Show>
    </TableCell>
  </TableRow>
);

const SlotTiles = (props: {
  slot: Slot;
  items: Map<string, DimItem>;
  values: Record<number, number>;
  onSelect: (item: DimItem) => void;
}) => (
  <div
    class="flex flex-col gap-1"
    classList={{ "opacity-40": props.slot.remaining === 0 }}
  >
    <span class={LABEL}>{readable(props.slot.name, props.values)}</span>
    <div class="flex flex-wrap gap-1">
      <For each={props.slot.items}>
        {(one) => (
          <Show
            when={props.items.get(tileKey(one.vendor, one.vendorItemIndex))}
          >
            {(item) => <ItemTile item={item()} onSelect={props.onSelect} />}
          </Show>
        )}
      </For>
    </div>
  </div>
);

const clockAt = (vendor: VendorState, now: number): number | undefined => {
  if (vendor.mode === "visit") {
    return visitEndsAt(now);
  }

  if (vendor.mode === "rotation") {
    return nextDailyReset(now);
  }

  return vendor.refreshesAt;
};

export const VendorClock = (props: { vendor: VendorState; now: number }) => (
  <Show when={clockAt(props.vendor, props.now)}>
    {(at) => (
      <span
        class={HEADING_NOTE}
        title={`${
          props.vendor.mode === "visit" ? "Leaves" : "Refreshes"
        } ${exact(at())}`}
      >
        {remaining(at() - props.now)} left
      </span>
    )}
  </Show>
);

export const VendorSection = (props: {
  vendor: VendorState;
  items: Map<string, DimItem>;
  now: number;
  values: Record<number, number>;
  collected: (itemHash: number) => boolean | undefined;
  onSelect: (item: DimItem) => void;
}) => (
  <section class={SECTION}>
    <h2 class={`${HEADING} flex items-baseline gap-2`}>
      {props.vendor.name}
      <VendorClock vendor={props.vendor} now={props.now} />
    </h2>

    <Show when={props.vendor.slots.length > 0}>
      <div class="flex flex-wrap gap-4">
        <For each={props.vendor.slots}>
          {(slot) => (
            <SlotTiles
              slot={slot}
              items={props.items}
              values={props.values}
              onSelect={props.onSelect}
            />
          )}
        </For>
      </div>
    </Show>

    <Show when={props.vendor.rows.length > 0}>
      <div class="flex flex-col gap-1">
        <For each={props.vendor.rows}>
          {(row) => (
            <div class="flex flex-wrap gap-1">
              <For each={row}>
                {(one) => (
                  <Show
                    when={props.items.get(
                      tileKey(one.vendor, one.vendorItemIndex),
                    )}
                  >
                    {(item) => (
                      <ItemTile
                        item={item()}
                        class={one.purchased ? "opacity-40" : undefined}
                        notes={[
                          ...one.reasons,
                          ...(props.collected(one.itemHash)
                            ? ["Unlocked"]
                            : []),
                        ]}
                        cost={one.cost}
                        onSelect={props.onSelect}
                      />
                    )}
                  </Show>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </Show>

    <Show when={props.vendor.offers.length > 0}>
      <div class={TABLE_FRAME}>
        <Table>
          <TableBody>
            <For each={props.vendor.offers}>
              {(offer) => <OfferRow offer={offer} now={props.now} />}
            </For>
          </TableBody>
        </Table>
      </div>
    </Show>
  </section>
);

export const IdleVendors = (props: { vendors: VendorState[]; now: number }) => (
  <section class={SECTION}>
    <h2 class={HEADING}>Nothing to buy</h2>
    <div class={TABLE_FRAME}>
      <Table>
        <TableBody>
          <For each={props.vendors}>
            {(vendor) => (
              <TableRow>
                <TableCell class="w-2/5">{vendor.name}</TableCell>
                <TableCell class="text-right">
                  <VendorClock vendor={vendor} now={props.now} />
                </TableCell>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>
    </div>
  </section>
);
