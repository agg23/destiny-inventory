import type {
  InventoryBucket,
  InventoryBuckets,
} from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { potentialSpaceLeftForItem } from "app/inventory/stores-helpers";
import { createMemo, For, Show } from "solid-js";

import { CharacterPicker, StoreBanner } from "./CharacterPicker.tsx";
import { unmovable } from "./compare.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { LOST_ITEMS } from "./ItemPanel.tsx";
import { Button } from "./ui/Button.tsx";

const CATEGORIES = ["Postmaster", "Weapons", "Armor", "General", "Inventory"];

interface Props {
  stores: DimStore[];
  buckets: InventoryBuckets;
  matches: (item: DimItem) => boolean;
  onSelect: (item: DimItem, additive: boolean) => void;
  pinned: DimItem[];
  active: DimStore | undefined;
  onSelectStore: (store: DimStore) => void;
  onCollect: (items: DimItem[], target: DimStore) => void;
  moving: string | undefined;
}

const VaultHeader = (props: { store: DimStore }) => (
  <div class="card store-head flex items-center gap-2 p-2">
    <StoreBanner
      icon={props.store.icon}
      title="Vault"
      note={`${props.store.items.length} items`}
    />
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

  // Quests and Orders carry no sort
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

  const cell = (store: DimStore, bucket: InventoryBucket) =>
    ordered(byStore().get(store.id)?.get(bucket.hash) ?? []);

  const collectible = createMemo(() => {
    const character = shown().find((store) => !store.isVault);

    if (!character) {
      return undefined;
    }

    const eligible = character.items.filter(
      (item) =>
        item.location.hash === LOST_ITEMS &&
        !unmovable(item) &&
        item.canPullFromPostmaster,
    );

    const items = eligible.filter((item) => {
      const space = potentialSpaceLeftForItem(character, item, props.stores);

      return space.guaranteed > 0 || space.couldMakeSpace;
    });

    return { character, items, empty: eligible.length === 0 };
  });

  return (
    <div class="p-3">
      <div class="stores">
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
            <h2 class="section-label mt-4 mb-1.5">
              {section.category}
              <Show when={section.category === "Postmaster" && collectible()}>
                {(found) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!!props.moving || found().items.length === 0}
                    title={
                      found().items.length > 0
                        ? undefined
                        : found().empty
                          ? "Nothing to pull"
                          : "Cannot pull available items"
                    }
                    onClick={() =>
                      props.onCollect(found().items, found().character)
                    }
                  >
                    Collect all ({found().items.length})
                  </Button>
                )}
              </Show>
            </h2>
            <For each={section.buckets}>
              {(bucket) => (
                <div class="row">
                  <h3 class="bucket-label">
                    {bucket.name || `Bucket ${bucket.hash}`}
                  </h3>
                  <For each={shown()}>
                    {(store) => (
                      <div
                        class="item-grid wide"
                        classList={{ character: !store.isVault }}
                      >
                        <For each={cell(store, bucket)}>
                          {(item) => (
                            <ItemIcon
                              item={item}
                              selected={props.pinned.some(
                                (pin) => pin.id === item.id,
                              )}
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
