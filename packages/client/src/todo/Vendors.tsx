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
import { exact } from "./todoFormat.ts";

const OfferRow = (props: { offer: Offer }) => (
  <tr classList={{ blocked: !props.offer.available }}>
    <td>
      <span class="cell-lead">
        <Show when={props.offer.icon}>
          {(icon) => (
            <img
              class="glyph"
              src={`${BUNGIE}${icon()}`}
              alt={props.offer.name}
            />
          )}
        </Show>
        {props.offer.name}
        <Show when={props.offer.quantity > 1}>
          {" "}
          <span class="text-muted">x{props.offer.quantity}</span>
        </Show>
      </span>
    </td>
    <td>
      <Show
        when={props.offer.reasons.length > 0}
        fallback={<span class="text-success">Available</span>}
      >
        <span class="text-warning">{props.offer.reasons.join(" · ")}</span>
      </Show>
    </td>
    <td class="num tabular-nums">
      <For each={props.offer.costs}>
        {(cost) => (
          <>
            {cost.quantity.toLocaleString()} {cost.name}
          </>
        )}
      </For>
    </td>
  </tr>
);

const SlotTiles = (props: {
  vendor: number;
  slot: Slot;
  items: Map<string, DimItem>;
  values: Record<number, number>;
  onSelect: (item: DimItem) => void;
}) => (
  <div class="vendor-slot" classList={{ spent: props.slot.remaining === 0 }}>
    <span class="slot-label">{readable(props.slot.name, props.values)}</span>
    <div class="slot-tiles">
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
        class="section-note whitespace-nowrap tabular-nums"
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
  <section class="todo-section">
    <h2 class="section-label">
      {props.vendor.name}
      <VendorClock vendor={props.vendor} now={props.now} />
    </h2>

    <Show when={props.vendor.slots.length > 0}>
      <div class="slot-strip">
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
      <table class="table">
        <tbody>
          <For each={props.vendor.offers}>
            {(offer) => <OfferRow offer={offer} />}
          </For>
        </tbody>
      </table>
    </Show>
  </section>
);

export const IdleVendors = (props: { vendors: VendorState[]; now: number }) => (
  <section class="todo-section">
    <h2 class="section-label">Nothing to buy</h2>
    <table class="table">
      <tbody>
        <For each={props.vendors}>
          {(vendor) => (
            <tr>
              <td>{vendor.name}</td>
              <td class="num tabular-nums">
                <VendorClock vendor={vendor} now={props.now} />
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </section>
);
