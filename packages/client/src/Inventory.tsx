import type {
  InventoryBucket,
  InventoryBuckets,
} from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { potentialSpaceLeftForItem } from "app/inventory/stores-helpers";
import { createMemo, createSignal, For, Index, Show } from "solid-js";

import type { Matched } from "./App.tsx";
import { CharacterPicker, StoreBanner } from "./CharacterPicker.tsx";
import { unmovable } from "./compare.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { ItemMenu } from "./ItemMenu.tsx";
import { LOST_ITEMS } from "./moveTargets.ts";
import { previewed } from "./preview.ts";
import { Button } from "./ui/Button.tsx";

const CATEGORIES = ["Postmaster", "Weapons", "Armor", "General", "Inventory"];

const SECTIONS = [...CATEGORIES, "Other"];

interface Props {
  stores: DimStore[];
  buckets: InventoryBuckets;
  matched: Matched;
  onSelect: (item: DimItem, additive: boolean) => void;
  pinned: DimItem[];
  active: DimStore | undefined;
  onSelectStore: (store: DimStore) => void;
  onCollect: (items: DimItem[], target: DimStore) => void;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onUnpin: (item: DimItem) => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
  onQuery: (query: string) => void;
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

const sameBuckets = (was: InventoryBucket[], next: InventoryBucket[]): boolean =>
  was.length === next.length && was.every((bucket, at) => bucket === next[at]);

const ordered = (items: DimItem[]): DimItem[] =>
  [...items].sort(
    (a, b) => Number(b.equipped) - Number(a.equipped) || b.power - a.power,
  );

export const Inventory = (props: Props) => {
  const byStore = () => props.matched.byStore;

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

    for (const [id, buckets] of byStore()) {
      for (const [hash, items] of buckets) {
        built.set(`${id}:${hash}`, ordered(items));
      }
    }

    return built;
  });

  const cell = (store: DimStore, bucket: InventoryBucket) =>
    cells().get(`${store.id}:${bucket.hash}`) ?? [];

  const [menuFor, setMenuFor] = createSignal<DimItem | undefined>(undefined);
  const [menuOpen, setMenuOpen] = createSignal(false);

  const tileState = (item: DimItem): string =>
    [
      previewed()?.item.index === item.index ? "hovered" : "",
      menuOpen() && menuFor()?.index === item.index ? "menued" : "",
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

  // Capture phase - a miss must not reach the menu's own handler
  const onContextMenu = (e: MouseEvent) => {
    const tile = (e.target as HTMLElement).closest("[data-item-index]");
    const index = tile?.getAttribute("data-item-index") ?? undefined;
    const found = index === undefined ? undefined : itemAt(index);

    if (!found) {
      e.stopPropagation();

      return;
    }

    setMenuFor(found);
  };

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
    <ItemMenu
      item={menuFor()}
      stores={props.stores}
      active={props.active}
      pinned={props.pinned}
      moving={props.moving}
      onMove={props.onMove}
      onPin={(item) => props.onSelect(item, false)}
      onUnpin={props.onUnpin}
      onCompare={props.onCompare}
      onQuery={props.onQuery}
      onOpenChange={setMenuOpen}
    >
      <div
        class="p-3"
        on:contextmenu={{ handleEvent: onContextMenu, capture: true }}
      >
        <div class="stores">
          <CharacterPicker
            characters={characters()}
            selected={props.active}
            onSelect={props.onSelectStore}
          />
          <Show when={vault()}>{(store) => <VaultHeader store={store()} />}</Show>
        </div>

        <For each={SECTIONS}>
          {(category) => (
            <Show when={bucketsIn(category).some((bucket) => occupied(bucket))}>
              <section>
                <h2 class="section-label mt-4 mb-1.5">
                  {category}
                  <Show when={category === "Postmaster" && collectible()}>
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
                <Index each={bucketsIn(category)}>
                  {(bucket) => (
                    <Show when={occupied(bucket())}>
                      <div class="row">
                        <h3 class="bucket-label">
                          {bucket().name || `Bucket ${bucket().hash}`}
                        </h3>
                        <For each={shown()}>
                          {(store) => (
                            <div
                              class="item-grid wide"
                              classList={{ character: !store.isVault }}
                            >
                              <For each={cell(store, bucket())}>
                                {(item) => (
                                  <ItemIcon
                                    item={item}
                                    selected={props.pinned.some(
                                      (pin) => pin.id === item.id,
                                    )}
                                    class={tileState(item)}
                                    onSelect={props.onSelect}
                                  />
                                )}
                              </For>
                            </div>
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
