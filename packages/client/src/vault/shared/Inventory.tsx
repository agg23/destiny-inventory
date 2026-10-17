import type {
  InventoryBucket,
  InventoryBuckets,
} from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { potentialSpaceLeftForItem } from "app/inventory/stores-helpers";
import { BucketHashes } from "data/d2/generated-enums";
import { createMemo, For, Index, onCleanup, Show } from "solid-js";

import { CharacterPicker } from "../../components/CharacterPicker.tsx";
import { ItemIcon } from "../../components/ItemIcon.tsx";
import { ItemMenu } from "../../components/ItemMenu.tsx";
import { HEADING, LABEL } from "../../components/lib/text.ts";
import { Button } from "../../components/lib/zaidan/button.tsx";
import type { Matched } from "../../core/app/matched.ts";
import { unmovable } from "../../core/items/compare.ts";
import { menued } from "../../core/items/itemMenu.ts";
import { previewed } from "../../core/items/preview.ts";
import { tagFor } from "../../core/items/tags.ts";
import { LOST_ITEMS } from "../../core/profile/moveTargets.ts";
import { settings } from "../../core/settings.ts";
import { createDragSelect } from "./dragSelect.ts";
import { VaultHeader } from "./VaultHeader.tsx";

const COLUMNS =
  "grid grid-cols-[var(--store-column)_minmax(0,1fr)] items-start gap-2";

const CATEGORIES = ["Postmaster", "Weapons", "Armor", "General", "Inventory"];

const SECTIONS = [...CATEGORIES, "Other"];

interface Props {
  stores: DimStore[];
  buckets: InventoryBuckets;
  matched: Matched;
  selected: DimItem[];
  isSelected: (item: DimItem) => boolean;
  onSelect: (item: DimItem) => void;
  onToggle: (item: DimItem) => void;
  onExtend: (item: DimItem, order: DimItem[]) => void;
  onSelectMany: (items: DimItem[]) => void;
  active: DimStore | undefined;
  onSelectStore: (store: DimStore) => void;
  onCollect: (items: DimItem[], target: DimStore) => void;
  moving: string | undefined;
}

const sameBuckets = (was: InventoryBucket[], next: InventoryBucket[]): boolean =>
  was.length === next.length && was.every((bucket, at) => bucket === next[at]);

const ordered = (items: DimItem[]): DimItem[] =>
  [...items].sort(
    (a, b) => Number(b.equipped) - Number(a.equipped) || b.power - a.power,
  );

const orderedVault = (items: DimItem[]): DimItem[] =>
  settings().sort === "name"
    ? [...items].sort(
        (a, b) => a.name.localeCompare(b.name) || b.power - a.power,
      )
    : ordered(items);

const favorite = (item: DimItem): boolean => tagFor(item.id)?.id === "favorite";

export const Inventory = (props: Props) => {
  const byStore = () => props.matched.byStore;

  const characters = () => props.stores.filter((store) => !store.isVault);
  const vault = () => props.stores.find((store) => store.isVault);
  // Always in the manifest
  const vaultCapacity = () =>
    props.buckets.byHash[BucketHashes.General]!.capacity;

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

  const hits = createMemo(() => {
    const found = new Set<DimItem>();

    for (const buckets of byStore().values()) {
      for (const items of buckets.values()) {
        for (const item of items) {
          found.add(item);
        }
      }
    }

    return found;
  });

  // Quests and Orders carry no sort
  const uncategorized = createMemo<InventoryBucket[]>(
    () => {
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
    },
    [],
    { equals: sameBuckets },
  );

  const bucketsIn = (category: string) =>
    category === "Other"
      ? uncategorized()
      : (props.buckets.byCategory[category] ?? []);

  const cells = createMemo(() => {
    const built = new Map<string, DimItem[]>();

    for (const store of props.stores) {
      for (const item of store.items) {
        const key = `${store.id}:${item.location.hash}`;
        const items = built.get(key) ?? [];
        items.push(item);
        built.set(key, items);
      }
    }

    const vaultId = vault()?.id;

    for (const [key, items] of built) {
      built.set(
        key,
        key.startsWith(`${vaultId}:`) ? orderedVault(items) : ordered(items),
      );
    }

    return built;
  });

  const cell = (store: DimStore, bucket: InventoryBucket) =>
    cells().get(`${store.id}:${bucket.hash}`) ?? [];

  const present = (bucket: InventoryBucket) =>
    shown().some((store) => cell(store, bucket).length > 0);

  const vaultCells = createMemo(() => {
    const split = new Map<number, { favorites: DimItem[]; rest: DimItem[] }>();
    const held = vault();

    if (!held) {
      return split;
    }

    for (const [key, items] of cells()) {
      if (key.startsWith(`${held.id}:`)) {
        split.set(Number(key.slice(held.id.length + 1)), {
          favorites: items.filter((item) => favorite(item)),
          rest: items.filter((item) => !favorite(item)),
        });
      }
    }

    return split;
  });

  const vaultCell = (bucket: InventoryBucket) =>
    vaultCells().get(bucket.hash) ?? { favorites: [], rest: [] };

  const vaultOrder = (bucket: InventoryBucket) => {
    const split = vaultCell(bucket);

    return [...split.favorites, ...split.rest];
  };

  const tileState = (item: DimItem): string =>
    [
      previewed()?.item.index === item.index ? "hovered" : "",
      menued(item) ? "menued" : "",
      hits().has(item) ? "" : "hidden",
    ]
      .filter((part) => part.length > 0)
      .join(" ");

  const itemAt = (index: string): DimItem | undefined => {
    for (const store of props.stores) {
      const found = store.items.find((one) => one.index === index);

      if (found) {
        return found;
      }
    }

    return undefined;
  };

  let root: HTMLDivElement | undefined = undefined;

  const drag = createDragSelect(
    () => root,
    (indexes, additive) => {
      const byIndex = new Map(
        props.stores.flatMap((store) =>
          store.items.map((one) => [one.index, one]),
        ),
      );
      const swept = indexes.flatMap((index) => {
        const found = byIndex.get(index);

        return found === undefined ? [] : [found];
      });

      if (!additive) {
        props.onSelectMany(swept);

        return;
      }

      const held = new Set(props.selected.map((one) => one.id));

      props.onSelectMany([
        ...props.selected,
        ...swept.filter((one) => !held.has(one.id)),
      ]);
    },
  );

  const tileSelected = (item: DimItem): boolean => {
    const swept = drag.dragged();

    if (!swept) {
      return props.isSelected(item);
    }

    return (
      swept.has(item.index) || (drag.additive() && props.isSelected(item))
    );
  };

  const onTile = (item: DimItem, event: MouseEvent, order: DimItem[]) => {
    if (event.metaKey || event.ctrlKey) {
      props.onToggle(item);

      return;
    }

    if (event.shiftKey) {
      props.onExtend(item, order.filter((one) => hits().has(one)));

      return;
    }

    props.onSelect(item);
  };

  const tile = (item: DimItem, order: () => DimItem[]) => (
    <ItemIcon
      item={item}
      selected={tileSelected(item)}
      class={tileState(item)}
      onSelect={(one, event) => onTile(one, event, order())}
    />
  );

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    if (
      !(event.metaKey || event.ctrlKey) ||
      event.key !== "a" ||
      target.closest("input, textarea, select, [contenteditable]")
    ) {
      return;
    }

    event.preventDefault();
    props.onSelectMany(
      shown().flatMap((store) => store.items.filter((one) => hits().has(one))),
    );
  };

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

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
    <ItemMenu find={itemAt} selection={() => props.selected}>
      <div
        ref={root}
        class="px-4 pb-4 select-none data-selecting:[&_.item-tile]:pointer-events-none"
        data-selecting={drag.box() ? "" : undefined}
        onPointerDown={drag.onPointerDown}
        onDragStart={(event) => event.preventDefault()}
      >
        <Show when={drag.box()}>
          {(box) => (
            <div
              class="pointer-events-none fixed z-3 border border-cream bg-cream/15"
              style={{
                left: `${box().left}px`,
                top: `${box().top}px`,
                width: `${box().width}px`,
                height: `${box().height}px`,
              }}
            />
          )}
        </Show>
        <div class={`${COLUMNS} sticky top-(--header-h,49px) z-1 bg-background py-3`}>
          <CharacterPicker
            characters={characters()}
            selected={props.active}
            onSelect={props.onSelectStore}
          />
          <Show when={vault()}>
            {(store) => (
              <VaultHeader
                store={store()}
                capacity={vaultCapacity()}
              />
            )}
          </Show>
        </div>

        <For each={SECTIONS}>
          {(category) => (
            <Show when={bucketsIn(category).some((bucket) => present(bucket))}>
              <section
                classList={{
                  hidden: !bucketsIn(category).some((bucket) =>
                    occupied(bucket),
                  ),
                }}
              >
                <h2 class={`${HEADING} mt-4 mb-1.5 flex h-7 items-center gap-3`}>
                  {category}
                  <Show when={category === "Postmaster" && collectible()}>
                    {(found) => (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
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
                <Index each={bucketsIn(category)}>
                  {(bucket) => (
                    <Show when={present(bucket())}>
                      <div
                        class={`row ${COLUMNS} border-t py-1`}
                        classList={{ hidden: !occupied(bucket()) }}
                      >
                        <h3 class={`${LABEL} col-span-full mb-1`}>
                          {bucket().name || `Bucket ${bucket().hash}`}
                        </h3>
                        <For each={shown()}>
                          {(store) => (
                            <Show
                              when={store.isVault}
                              fallback={
                                <div class="item-grid wide character">
                                  <For each={cell(store, bucket())}>
                                    {(item) =>
                                      tile(item, () => cell(store, bucket()))
                                    }
                                  </For>
                                </div>
                              }
                            >
                              <div>
                                <div
                                  class="item-grid wide favorites"
                                  classList={{
                                    hidden: !vaultCell(bucket()).favorites.some(
                                      (item) => hits().has(item),
                                    ),
                                  }}
                                >
                                  <For each={vaultCell(bucket()).favorites}>
                                    {(item) =>
                                      tile(item, () => vaultOrder(bucket()))
                                    }
                                  </For>
                                </div>
                                <div
                                  class="item-grid wide"
                                  classList={{
                                    hidden: !vaultCell(bucket()).rest.some(
                                      (item) => hits().has(item),
                                    ),
                                  }}
                                >
                                  <For each={vaultCell(bucket()).rest}>
                                    {(item) =>
                                      tile(item, () => vaultOrder(bucket()))
                                    }
                                  </For>
                                </div>
                              </div>
                            </Show>
                          )}
                        </For>
                      </div>
                    </Show>
                  )}
                </Index>
              </section>
            </Show>
          )}
        </For>
      </div>
    </ItemMenu>
  );
};
