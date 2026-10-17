import { useNavigate } from "@solidjs/router";
import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource, For, Show } from "solid-js";

import { CharacterPicker } from "../components/CharacterPicker.tsx";
import {
  HEADING,
  HEADING_NOTE,
  SECTION,
  TABLE_FRAME,
} from "../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../components/lib/zaidan/table.tsx";
import { RAIL } from "../components/rail/Rail.tsx";
import { useApp } from "../core/app/state.ts";
import { useClock } from "../core/clock.ts";
import {
  definedSession,
  entryForHash,
  primeCollections,
} from "../core/collections/collections.ts";
import { acquiredFor, isCollected } from "../core/collections/ownership.ts";
import {
  builtTiles,
  vendorTiles,
  type VendorTile,
} from "../core/profile/fakeItems.ts";
import { railCollapsed } from "../core/rail.ts";
import {
  orderPayouts,
  seasonalChallenges,
  type ChallengeGroup,
  type OrderPayout,
} from "../core/todo/challenges.ts";
import {
  activeOrders,
  orderLedger,
  type Claimed,
  type Order,
} from "../core/todo/orders.ts";
import { fetchVendorState, lastVendorFetch } from "../core/todo/vendorFetch.ts";
import {
  priorityOffers,
  rankResets,
  readVendors,
} from "../core/todo/vendors.ts";
import type {
  Priority,
  RankReset,
  VendorState,
} from "../core/todo/vendorTypes.ts";
import { entryHref } from "../core/url.ts";
import { Challenges } from "./shared/Challenges.tsx";
import { ClaimedLog, OrderCard } from "./shared/Orders.tsx";
import { deadlines, Resets, type Deadline } from "./shared/Resets.tsx";
import { held, MINUTE } from "./shared/todoFormat.ts";
import { IdleVendors, VendorSection } from "./shared/Vendors.tsx";

const stocked = (vendors: VendorState[]): VendorState[] =>
  vendors.filter(
    (vendor) =>
      vendor.slots.length > 0 ||
      vendor.offers.length > 0 ||
      vendor.rows.length > 0,
  );

export const Todo = () => {
  const app = useApp();
  const navigate = useNavigate();
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
    () =>
      activeOrders(
        app.stores().filter((store) => store.id === app.active()?.id),
        settled(),
      ),
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
      fetchVendorState(
        loaded.session.membership,
        character,
        loaded.stores
          .filter((store) => !store.isVault)
          .map((store) => ({ id: store.id, classType: store.classType })),
      ),
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
            app.loaded()?.variables[fetched.character] ?? {},
            app.stores().find((store) => store.id === fetched.character)
              ?.items ?? [],
            fetched.ornaments,
          );
    },
    undefined,
    held<VendorState>(),
  );
  const idle = createMemo(
    () =>
      stock().filter(
        (vendor) =>
          vendor.slots.length === 0 &&
          vendor.offers.length === 0 &&
          vendor.rows.length === 0,
      ),
    undefined,
    held<VendorState>(),
  );

  // Keyed on the tiles themselves, so a rebuilt stock does not refetch the same items
  const slotted = createMemo(
    () =>
      stock().flatMap((vendor) => [
        ...vendor.slots.flatMap((slot) => slot.items),
        ...vendor.rows.flat(),
      ]),
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

  const [collection] = createResource(
    () => definedSession(app.loaded()?.session),
    (session) =>
      Promise.all([primeCollections(session), acquiredFor(session)])
        .then(([index, acquired]) => ({ index, acquired }))
        // Tiles just go without the unlocked marker
        .catch(() => undefined),
  );

  const collected = (itemHash: number): boolean | undefined => {
    const loaded = collection();
    const entry =
      loaded === undefined ? undefined : entryForHash(loaded.index, itemHash);

    return loaded === undefined || entry === undefined
      ? undefined
      : isCollected(entry, loaded.acquired);
  };

  const ranks = createMemo(
    () => rankResets(vendors()?.response),
    undefined,
    held<RankReset>(),
  );

  const openEntry = (item: DimItem) =>
    navigate(
      entryHref(item.hash, { kind: item.bucket.inArmor ? "armor" : "weapon" }),
    );

  return (
    <>
      <div class="flex flex-col gap-6 px-4 pt-3 pb-4">
        <div class="w-(--store-column)">
          <CharacterPicker
            characters={app.stores().filter((store) => !store.isVault)}
            selected={app.active()}
            onSelect={app.onCharacter}
          />
        </div>

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

        <Show when={ranks().length > 0}>
          <section class={SECTION}>
            <h2 class={HEADING}>Rank resets</h2>
            <div class={TABLE_FRAME}>
              <Table>
                <TableBody>
                  <For each={ranks()}>
                    {(rank) => (
                      <TableRow>
                        <TableCell class="w-2/5">{rank.name}</TableCell>
                        <TableCell>
                          <Show
                            when={rank.rank >= rank.cap}
                            fallback={`Rank ${rank.rank} of ${rank.cap}`}
                          >
                            <span class="text-warning">Ready to reset</span>
                          </Show>
                        </TableCell>
                        <TableCell class="text-right tabular-nums text-muted-foreground">
                          {rank.resets === 1
                            ? "1 reset"
                            : `${rank.resets} resets`}
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
              collected={collected}
              onSelect={openEntry}
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
