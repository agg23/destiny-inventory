import type { InventoryBucket, InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, For, Show } from "solid-js";

import { ItemIcon } from "./ItemIcon.tsx";

const CATEGORIES = ["Postmaster", "Weapons", "Armor", "General", "Inventory"];

interface Props {
  stores: DimStore[];
  buckets: InventoryBuckets;
  matches: (item: DimItem) => boolean;
  onSelect: (item: DimItem) => void;
  selected: DimItem | undefined;
}

// store.name comes from DIM's i18n, which the bridge shims down to the raw key
const CharacterHeader = (props: { store: DimStore }) => (
  <div class="store-head" style={{ "background-image": `url(${props.store.background})` }}>
    <img src={props.store.icon} alt="" width="40" height="40" />
    <Show
      when={!props.store.isVault}
      fallback={
        <div>
          <div class="name">Vault</div>
          <div class="meta">{props.store.items.length} items</div>
        </div>
      }
    >
      <div>
        <div class="name">{props.store.className}</div>
        <div class="meta">
          {props.store.genderRace} · {props.store.powerLevel}
        </div>
      </div>
    </Show>
  </div>
);

// Equipped first, then heaviest, which is the order the game shows and the eye expects
const ordered = (items: DimItem[]): DimItem[] =>
  [...items].sort((a, b) => Number(b.equipped) - Number(a.equipped) || b.power - a.power);

export const Inventory = (props: Props) => {
  const byStore = createMemo(() => {
    const table = new Map<string, Map<number, DimItem[]>>();

    for (const store of props.stores) {
      const buckets = new Map<number, DimItem[]>();

      for (const item of store.items) {
        if (props.matches(item)) {
          const bucket = buckets.get(item.bucket.hash) ?? [];
          bucket.push(item);
          buckets.set(item.bucket.hash, bucket);
        }
      }

      table.set(store.id, buckets);
    }

    return table;
  });

  const occupied = (bucket: InventoryBucket) =>
    props.stores.some((store) => byStore().get(store.id)?.has(bucket.hash));

  // Quests, Orders and friends carry no sort, so they belong to no category. Collecting them
  // rather than dropping them is the difference between a view and an accurate one
  const uncategorised = createMemo(() => {
    const known = new Set(
      CATEGORIES.flatMap((category) => props.buckets.byCategory[category] ?? []).map(
        (bucket) => bucket.hash,
      ),
    );

    const found = new Map<number, InventoryBucket>();

    for (const store of props.stores) {
      for (const item of store.items) {
        if (!known.has(item.bucket.hash)) {
          found.set(item.bucket.hash, item.bucket);
        }
      }
    }

    return [...found.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  });

  // A bucket with nothing in it anywhere is noise, especially while filtering
  const rows = createMemo(() =>
    [
      ...CATEGORIES.map((category) => ({
        category,
        buckets: props.buckets.byCategory[category] ?? [],
      })),
      { category: "Other", buckets: uncategorised() },
    ]
      .map((section) => ({ ...section, buckets: section.buckets.filter(occupied) }))
      .filter((section) => section.buckets.length > 0),
  );

  const columns = () => `140px repeat(${props.stores.length}, minmax(0, 1fr))`;

  const cell = (store: DimStore, bucket: InventoryBucket) =>
    ordered(byStore().get(store.id)?.get(bucket.hash) ?? []);

  return (
    <div class="inventory">
      <div class="stores" style={{ "grid-template-columns": columns() }}>
        <div />
        <For each={props.stores}>{(store) => <CharacterHeader store={store} />}</For>
      </div>

      <For each={rows()}>
        {(section) => (
          <section>
            <h2>{section.category}</h2>
            <For each={section.buckets}>
              {(bucket) => (
                <div class="row" style={{ "grid-template-columns": columns() }}>
                  <div class="bucket">{bucket.name || `Bucket ${bucket.hash}`}</div>
                  <For each={props.stores}>
                    {(store) => (
                      <div class="cell">
                        <For each={cell(store, bucket)}>
                          {(item) => (
                            <ItemIcon
                              item={item}
                              selected={props.selected?.id === item.id}
                              onSelect={props.onSelect}
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
