import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { readable } from "../activities.ts";
import { BUNGIE } from "../bungie.ts";
import { tileKey } from "../fakeItems.ts";
import { ItemIcon } from "../ItemIcon.tsx";
import { remaining } from "../reset.ts";
import {
  visitEndsAt,
  type Offer,
  type Slot,
  type VendorState,
} from "../vendors.ts";
import {
  HEADING,
  HEADING_NOTE,
  LABEL,
  SECTION,
  TABLE_FRAME,
} from "../ui/text.ts";
import { Table, TableBody, TableCell, TableRow } from "../ui/zaidan/table.tsx";
import { exact } from "./todoFormat.ts";

const OfferRow = (props: { offer: Offer }) => (
  <TableRow classList={{ "text-muted-foreground": !props.offer.available }}>
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
      <Show
        when={props.offer.reasons.length > 0}
        fallback={<span class="text-good">Available</span>}
      >
        <span class="text-warning">{props.offer.reasons.join(" · ")}</span>
      </Show>
    </TableCell>
    <TableCell class="text-right tabular-nums">
      <For each={props.offer.costs}>
        {(cost) => (
          <>
            {cost.quantity.toLocaleString()} {cost.name}
          </>
        )}
      </For>
    </TableCell>
  </TableRow>
);

const SlotTiles = (props: {
  vendor: number;
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
            when={props.items.get(tileKey(props.vendor, one.vendorItemIndex))}
          >
            {(item) => <ItemIcon item={item()} onSelect={props.onSelect} />}
          </Show>
        )}
      </For>
    </div>
  </div>
);

export const VendorClock = (props: { vendor: VendorState; now: number }) => (
  <Show
    when={
      props.vendor.mode === "visit"
        ? visitEndsAt(props.now)
        : props.vendor.refreshesAt
    }
  >
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
              vendor={props.vendor.hash}
              slot={slot}
              items={props.items}
              values={props.values}
              onSelect={props.onSelect}
            />
          )}
        </For>
      </div>
    </Show>

    <Show when={props.vendor.offers.length > 0}>
      <div class={TABLE_FRAME}>
        <Table>
          <TableBody>
            <For each={props.vendor.offers}>
              {(offer) => <OfferRow offer={offer} />}
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
