import { createMemo, createResource, For, Show } from "solid-js";

import { useApp } from "../App.tsx";
import {
  orderPayouts,
  seasonalChallenges,
  type ChallengeGroup,
  type OrderPayout,
} from "../challenges.ts";
import { useClock } from "../clock.ts";
import { builtTiles, vendorTiles, type VendorTile } from "../fakeItems.ts";
import {
  activeOrders,
  orderLedger,
  type Claimed,
  type Order,
} from "../orders.ts";
import { railCollapsed } from "../rail.ts";
import { RAIL } from "../Rail.tsx";
import { HEADING, HEADING_NOTE, SECTION, TABLE_FRAME } from "../ui/text.ts";
import { Table, TableBody, TableCell, TableRow } from "../ui/zaidan/table.tsx";
import {
  fetchVendorState,
  lastVendorFetch,
  priorityOffers,
  readVendors,
  type Priority,
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
    ({ loaded, character }) =>
      fetchVendorState(loaded.session.membership, character),
    { initialValue: lastVendorFetch(app.active()?.id) },
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
    { initialValue: builtTiles() },
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
      <div class="flex flex-col gap-6 p-4">
        <Resets resets={resets()} now={now()} />

        <Show when={payouts().length > 0}>
          <section class={SECTION}>
            <h2 class={HEADING}>Order rewards waiting</h2>
            <div class={TABLE_FRAME}>
              <Table>
                <TableBody>
                  <For each={payouts()}>
                    {(payout) => (
                      <TableRow>
                        <TableCell class="w-2/5">{payout.name}</TableCell>
                        <TableCell class="text-right tabular-nums">
                          {payout.waiting}
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </section>
        </Show>

        <For each={challenges()}>
          {(group) => (
            <Challenges group={group} now={now()} values={values()} />
          )}
        </For>

        <Show when={priority().length > 0}>
          <section class={SECTION}>
            <h2 class={HEADING}>Priority stock</h2>
            <div class={TABLE_FRAME}>
              <Table>
                <TableBody>
                  <For each={priority()}>
                    {(offer) => (
                      <TableRow>
                        <TableCell class="w-2/5">{offer.name}</TableCell>
                        <TableCell class="text-muted-foreground">
                          {offer.vendor}
                        </TableCell>
                        <TableCell class="text-right tabular-nums">
                          <For each={offer.costs}>
                            {(cost) => (
                              <>
                                {cost.quantity.toLocaleString()} {cost.name}
                              </>
                            )}
                          </For>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
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
        <aside class={RAIL} data-rail>
          <div class="flex min-h-0 flex-col gap-2 overflow-y-auto p-4">
            <h2 class={`${HEADING} flex items-baseline gap-2`}>
              Active orders
              <span class={HEADING_NOTE}>
                {orders().length}
                <Show when={log().length > 0}> · {log().length} logged</Show>
              </span>
            </h2>
            <Show
              when={orders().length > 0}
              fallback={<p class="text-muted-foreground">No orders held.</p>}
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
