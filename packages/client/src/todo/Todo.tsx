import { createMemo, createResource, For, Show } from "solid-js";

import type { DimItem } from "app/inventory/item-types";

import { useApp } from "../App.tsx";
import { accessToken } from "../auth.ts";
import { fetchVendor, fetchVendors } from "../bungie.ts";
import {
  orderPayouts,
  seasonalChallenges,
  type ChallengeGroup,
  type OrderPayout,
} from "../challenges.ts";
import { PageChrome } from "../chrome.tsx";
import { useClock } from "../clock.ts";
import { vendorTiles, type VendorTile } from "../fakeItems.ts";
import {
  activeOrders,
  orderLedger,
  type Claimed,
  type Order,
} from "../orders.ts";
import { railCollapsed } from "../rail.ts";
import {
  priorityOffers,
  readVendors,
  TILED,
  vendorItems,
  type Priority,
  type VendorComponents,
  type VendorState,
} from "../vendors.ts";
import { Challenges } from "./Challenges.tsx";
import { ClaimedLog, OrderCard } from "./Orders.tsx";
import { deadlines, Resets, type Deadline } from "./Resets.tsx";
import { held, MINUTE } from "./todoFormat.ts";
import { IdleVendors, VendorSection } from "./Vendors.tsx";

const stocked = (vendors: VendorState[]): VendorState[] =>
  vendors.filter(
    (vendor) => vendor.slots.length > 0 || vendor.offers.length > 0,
  );

export const Todo = () => {
  const app = useApp();
  const now = useClock();
  const settled = createMemo(() => Math.floor(now() / MINUTE) * MINUTE);

  const values = () => {
    const character = app.active()?.id;

    return (
      (character === undefined
        ? undefined
        : app.loaded()?.variables[character]) ?? {}
    );
  };

  const orders = createMemo(
    () => activeOrders(app.stores(), settled()),
    undefined,
    held<Order>(),
  );
  const resets = createMemo(
    () => deadlines(now()),
    undefined,
    held<Deadline>(),
  );
  const log = createMemo(() => orderLedger().log, undefined, held<Claimed>());
  const challenges = createMemo(
    () => seasonalChallenges(app.loaded()?.records ?? {}, app.active()?.id),
    undefined,
    held<ChallengeGroup>(),
  );
  const payouts = createMemo(
    () =>
      orderPayouts(app.loaded()?.orderRewards ?? {}, app.active()?.id).filter(
        (one) => one.waiting > 0,
      ),
    undefined,
    held<OrderPayout>(),
  );

  const [vendors] = createResource(
    () => {
      const loaded = app.loaded();
      const character = app.active()?.id;

      return loaded && character ? { loaded, character } : undefined;
    },
    async ({ loaded, character }) => {
      const token = await accessToken();

      if (token === undefined) {
        return undefined;
      }

      const [response, items, ...tiled] = await Promise.all([
        fetchVendors(loaded.session.membership, character, token),
        vendorItems(),
        ...TILED.map((vendor) =>
          fetchVendor(loaded.session.membership, character, vendor, token),
        ),
      ]);

      const components: VendorComponents = {};

      TILED.forEach((vendor, at) => {
        const set = tiled[at]?.itemComponents;

        if (set) {
          components[vendor] = set;
        }
      });

      return { response, items, components };
    },
  );

  const stock = createMemo(
    () => {
      const fetched = vendors();

      return fetched === undefined
        ? []
        : readVendors(
            fetched.response,
            fetched.items,
            values(),
            app.active()?.items ?? [],
          );
    },
    undefined,
    held<VendorState>(),
  );
  const idle = createMemo(
    () =>
      stock().filter(
        (vendor) => vendor.slots.length === 0 && vendor.offers.length === 0,
      ),
    undefined,
    held<VendorState>(),
  );

  // Keyed on the tiles themselves, so a rebuilt stock does not refetch the same items
  const slotted = createMemo(
    () =>
      stock().flatMap((vendor) =>
        vendor.slots.flatMap((slot) =>
          slot.items.map(
            (one): VendorTile => ({ vendor: vendor.hash, ...one }),
          ),
        ),
      ),
    undefined,
    held<VendorTile>(),
  );

  const [offered] = createResource(
    () => {
      const loaded = app.loaded();
      const fetched = vendors();
      const tiles = slotted();

      return loaded && fetched && tiles.length > 0
        ? { loaded, components: fetched.components, tiles }
        : undefined;
    },
    ({ loaded, components, tiles }) => vendorTiles(loaded, components, tiles),
    { initialValue: new Map<string, DimItem>() },
  );

  const priority = createMemo(
    () => {
      const fetched = vendors();

      return fetched === undefined
        ? []
        : priorityOffers(fetched.response, fetched.items).filter(
            (one) => one.available,
          );
    },
    undefined,
    held<Priority>(),
  );

  return (
    <>
      <PageChrome
        status={
          <span>
            {orders().length} active{" "}
            {orders().length === 1 ? "order" : "orders"}
            <Show when={log().length > 0}> · {log().length} logged</Show>
          </span>
        }
      />

      <div class="todo-body">
        <Resets resets={resets()} now={now()} />

        <Show when={payouts().length > 0}>
          <section class="todo-section">
            <h2 class="section-label">Order rewards waiting</h2>
            <table class="table">
              <tbody>
                <For each={payouts()}>
                  {(payout) => (
                    <tr>
                      <td>{payout.name}</td>
                      <td class="num tabular-nums">{payout.waiting}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </section>
        </Show>

        <For each={challenges()}>
          {(group) => (
            <Challenges group={group} now={now()} values={values()} />
          )}
        </For>

        <Show when={priority().length > 0}>
          <section class="todo-section">
            <h2 class="section-label">Priority stock</h2>
            <table class="table">
              <tbody>
                <For each={priority()}>
                  {(offer) => (
                    <tr>
                      <td>{offer.name}</td>
                      <td class="text-muted">{offer.vendor}</td>
                      <td class="num tabular-nums">
                        <For each={offer.costs}>
                          {(cost) => (
                            <>
                              {cost.quantity.toLocaleString()} {cost.name}
                            </>
                          )}
                        </For>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </section>
        </Show>

        <For each={stocked(stock())}>
          {(vendor) => (
            <VendorSection
              vendor={vendor}
              items={offered()}
              now={now()}
              values={values()}
              onSelect={app.onPin}
            />
          )}
        </For>

        <Show when={idle().length > 0}>
          <IdleVendors vendors={idle()} now={now()} />
        </Show>

        <ClaimedLog log={log()} />
      </div>

      <Show when={!railCollapsed()}>
        <aside class="rail">
          <div class="orders p-3">
            <h2 class="section-label mb-2">Active orders</h2>
            <Show
              when={orders().length > 0}
              fallback={<p class="text-muted">No orders held.</p>}
            >
              <For each={orders()}>
                {(order) => (
                  <OrderCard order={order} now={now()} values={values()} />
                )}
              </For>
            </Show>
          </div>
        </aside>
      </Show>
    </>
  );
};
