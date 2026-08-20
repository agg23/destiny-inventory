import type {
  InventoryBucket,
  InventoryBuckets,
} from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { CharacterPicker } from "./CharacterPicker.tsx";
import { ItemIcon } from "./ItemIcon.tsx";

const CATEGORIES = ["Postmaster", "Weapons", "Armor", "General", "Inventory"];

const LABEL = 140;
const CHARACTER = 320;
const TILE = 48;
const GAPS = 16;

interface Props {
  stores: DimStore[];
  buckets: InventoryBuckets;
  matches: (item: DimItem) => boolean;
  onSelect: (item: DimItem) => void;
  onHover: (item: DimItem, anchor: DOMRect) => void;
  onLeave: (item: DimItem) => void;
  pinned: DimItem[];
  comparing: boolean;
  active: DimStore | undefined;
  onSelectStore: (store: DimStore) => void;
}

const VaultHeader = (props: { store: DimStore }) => (
  <div class="store-head">
    <img src={props.store.icon} alt="" width="40" height="40" />
    <div>
      <div class="name">Vault</div>
      <div class="meta">{props.store.items.length} items</div>
    </div>
  </div>
);

const ordered = (items: DimItem[]): DimItem[] =>
  [...items].sort(
    (a, b) => Number(b.equipped) - Number(a.equipped) || b.power - a.power,
  );

export const Inventory = (props: Props) => {
  const byStore = createMemo(() => {
    const table = new Map<string, Map<number, DimItem[]>>();

    for (const store of props.stores) {
      const buckets = new Map<number, DimItem[]>();

      for (const item of store.items) {
        if (props.matches(item)) {
          const bucket = buckets.get(item.location.hash) ?? [];
          bucket.push(item);
          buckets.set(item.location.hash, bucket);
        }
      }

      table.set(store.id, buckets);
    }

    return table;
  });

  const characters = () => props.stores.filter((store) => !store.isVault);
  const vault = () => props.stores.find((store) => store.isVault);

  const shown = createMemo(() => {
    const columns: DimStore[] = [];
    const character = props.active ?? characters()[0];

    if (character) {
      columns.push(character);
    }

    const held = vault();

    if (held) {
      columns.push(held);
    }

    return columns;
  });

  const occupied = (bucket: InventoryBucket) =>
    shown().some((store) => byStore().get(store.id)?.has(bucket.hash));

  // Quests and Orders carry no sort, so they belong to no category
  const uncategorized = createMemo(() => {
    const known = new Set(
      CATEGORIES.flatMap(
        (category) => props.buckets.byCategory[category] ?? [],
      ).map((bucket) => bucket.hash),
    );

    const found = new Map<number, InventoryBucket>();

    for (const store of props.stores) {
      for (const item of store.items) {
        if (!known.has(item.location.hash)) {
          found.set(item.location.hash, item.location);
        }
      }
    }

    return [...found.values()].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? ""),
    );
  });

  const rows = createMemo(() =>
    [
      ...CATEGORIES.map((category) => ({
        category,
        buckets: props.buckets.byCategory[category] ?? [],
      })),
      { category: "Other", buckets: uncategorized() },
    ]
      .map((section) => ({
        ...section,
        buckets: section.buckets.filter(occupied),
      }))
      .filter((section) => section.buckets.length > 0),
  );

  const [width, setWidth] = createSignal(0);

  let scroller: HTMLDivElement | undefined = undefined;

  // ResizeObserver delivers during rendering, so a background tab never gets a first measure
  const measure = () => {
    const box = scroller;

    if (box) {
      setWidth(
        box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2,
      );
    }
  };

  onMount(measure);

  // The rail widens on the second pin, which resizes this box without firing a window resize.
  // Driven off the state that causes it rather than a ResizeObserver, which only delivers as
  // part of the rendering steps and so never arrives in a tab that is not painting
  createEffect(() => {
    props.comparing;
    measure();
  });

  window.addEventListener("resize", measure);
  onCleanup(() => window.removeEventListener("resize", measure));

  const vaultWidth = () => {
    const spare = width() - LABEL - CHARACTER - GAPS;

    return Math.max(TILE, Math.floor(spare / TILE) * TILE);
  };

  const columns = () => `${LABEL}px ${CHARACTER}px ${vaultWidth()}px`;

  const cell = (store: DimStore, bucket: InventoryBucket) =>
    ordered(byStore().get(store.id)?.get(bucket.hash) ?? []);

  return (
    <div class="inventory" ref={(el) => (scroller = el)}>
      <div class="stores" style={{ "grid-template-columns": columns() }}>
        <div />
        <CharacterPicker
          characters={characters()}
          selected={props.active}
          onSelect={props.onSelectStore}
        />
        <Show when={vault()}>{(store) => <VaultHeader store={store()} />}</Show>
      </div>

      <For each={rows()}>
        {(section) => (
          <section>
            <h2>{section.category}</h2>
            <For each={section.buckets}>
              {(bucket) => (
                <div class="row" style={{ "grid-template-columns": columns() }}>
                  <div class="bucket">
                    {bucket.name || `Bucket ${bucket.hash}`}
                  </div>
                  <For each={shown()}>
                    {(store) => (
                      <div class="cell">
                        <For each={cell(store, bucket)}>
                          {(item) => (
                            <ItemIcon
                              item={item}
                              selected={props.pinned.some(
                                (pin) => pin.id === item.id,
                              )}
                              onSelect={props.onSelect}
                              onHover={props.onHover}
                              onLeave={props.onLeave}
                            />
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>
          </section>
        )}
      </For>
    </div>
  );
};
