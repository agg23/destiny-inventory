import type { InventoryBucket } from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { BucketHashes } from "data/d2/generated-enums";
import { createMemo, For, Index, onCleanup, Show } from "solid-js";

import { CharacterPicker } from "../../components/CharacterPicker.tsx";
import { ItemMenu } from "../../components/ItemMenu.tsx";
import { ItemTile } from "../../components/ItemTile.tsx";
import { HEADING, LABEL } from "../../components/lib/text.ts";
import { useApp } from "../../core/app/state.ts";
import { CollectAll } from "./CollectAll.tsx";
import { createDragSelect } from "./dragSelect.ts";
import { createVaultCells, SECTIONS } from "./vaultCells.ts";
import { VaultHeader } from "./VaultHeader.tsx";

const COLUMNS =
  "grid grid-cols-[var(--store-column)_minmax(0,1fr)] items-start gap-2";

const VAULT_PARTS = ["favorites", "rest"] as const;

export const Inventory = () => {
  const app = useApp();
  // Vault only renders this once loaded
  const buckets = () => app.loaded()!.buckets;
  const byStore = () => app.matched().byStore;

  const characters = () => app.stores().filter((store) => !store.isVault);
  const vault = () => app.stores().find((store) => store.isVault);
  // Always in the manifest
  const vaultCapacity = () => buckets().byHash[BucketHashes.General]!.capacity;

  const shown = createMemo(() => {
    const columns: DimStore[] = [];
    const character = app.active() ?? characters()[0];

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

  const { bucketsIn, cell, vaultCell, vaultOrder } = createVaultCells(
    app.stores,
    buckets,
  );

  const present = (bucket: InventoryBucket) =>
    shown().some((store) => cell(store, bucket).length > 0);

  const itemAt = (index: string): DimItem | undefined => {
    for (const store of app.stores()) {
      const found = store.items.find((one) => one.index === index);

      if (found) {
        return found;
      }
    }

    return undefined;
  };

  let root: HTMLDivElement | undefined = undefined;
  let extent: { anchor: string; base: string[] } | undefined = undefined;
  let cursor: string | undefined = undefined;

  const drag = createDragSelect(
    () => root,
    (indexes, additive) => {
      extent = undefined;
      cursor = undefined;

      const byIndex = new Map(
        app.stores().flatMap((store) =>
          store.items.map((one) => [one.index, one]),
        ),
      );
      const swept = indexes.flatMap((index) => {
        const found = byIndex.get(index);

        return found === undefined ? [] : [found];
      });

      if (!additive) {
        app.onSelectMany(swept);

        return;
      }

      const held = new Set(app.selected().map((one) => one.id));

      app.onSelectMany([
        ...app.selected(),
        ...swept.filter((one) => !held.has(one.id)),
      ]);
    },
  );

  const tileSelected = (item: DimItem): boolean => {
    const swept = drag.dragged();

    if (!swept) {
      return app.isSelected(item);
    }

    return swept.has(item.index) || (drag.additive() && app.isSelected(item));
  };

  const onTile = (item: DimItem, event: MouseEvent, order: DimItem[]) => {
    extent = undefined;
    cursor = undefined;

    if (event.metaKey || event.ctrlKey) {
      app.onToggle(item);

      return;
    }

    if (event.shiftKey) {
      app.onExtend(item, order.filter((one) => hits().has(one)));

      return;
    }

    app.onPin(item);
  };

  const tile = (item: DimItem, order: () => DimItem[]) => (
    <ItemTile
      item={item}
      selected={tileSelected(item)}
      highlight
      class={hits().has(item) ? undefined : "hidden"}
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
    app.onSelectMany(
      shown().flatMap((store) => store.items.filter((one) => hits().has(one))),
    );
  };

  const onArrowKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const held = app.selected();
    const last = held.find((one) => one.index === cursor) ?? held.at(-1);

    if (
      !event.key.startsWith("Arrow") ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !root ||
      !last ||
      target.closest(
        "input, textarea, select, [contenteditable], [role=menu], [role=listbox], [role=slider]",
      )
    ) {
      return;
    }

    const byIndex = new Map(
      app.stores().flatMap((store) =>
        store.items.map((one) => [one.index, one]),
      ),
    );
    const all = [...root.querySelectorAll<HTMLElement>("[data-item-index]")]
      .flatMap((element) => {
        const item = byIndex.get(element.dataset.itemIndex!);
        const rect = element.getBoundingClientRect();

        return item && rect.width > 0
          ? [{ item, rect, character: !!element.closest(".character") }]
          : [];
      })
      .sort((a, b) =>
        Math.abs(a.rect.top - b.rect.top) > a.rect.height / 2
          ? a.rect.top - b.rect.top
          : a.rect.left - b.rect.left,
      );
    const from = all.find((one) => one.item.index === last.index);

    if (!from) {
      return;
    }

    event.preventDefault();

    const tiles = all.filter((one) => one.item.id !== "0" || one === from);
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    let to = tiles[(tiles.indexOf(from) + step + tiles.length) % tiles.length]!;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const ahead = tiles.filter(
        (one) => step * (one.rect.top - from.rect.top) > from.rect.height / 2,
      );
      const own = (pool: typeof tiles) =>
        pool.filter((one) => one.character === from.character);
      const pool =
        own(ahead).length > 0
          ? own(ahead)
          : ahead.length > 0
            ? ahead
            : own(tiles);
      const rowTop = (step > 0 ? pool[0] : pool.at(-1))!.rect.top;

      to = pool
        .filter((one) => Math.abs(one.rect.top - rowTop) < from.rect.height / 2)
        .reduce((best, one) =>
          Math.abs(one.rect.left - from.rect.left) <
          Math.abs(best.rect.left - from.rect.left)
            ? one
            : best,
        );
    }

    if (to === from && held.length === 1) {
      return;
    }

    cursor = to.item.index;

    if (event.shiftKey) {
      extent ??= {
        anchor: from.item.index,
        base: held.map((one) => one.index),
      };

      const anchor = extent.anchor;
      const corner =
        all.find((one) => one.item.index === anchor)?.rect ?? from.rect;
      const left = Math.min(corner.left, to.rect.left);
      const right = Math.max(corner.right, to.rect.right);
      const top = Math.min(corner.top, to.rect.top);
      const bottom = Math.max(corner.bottom, to.rect.bottom);
      const inside = tiles.flatMap((one) => {
        const x = one.rect.left + one.rect.width / 2;
        const y = one.rect.top + one.rect.height / 2;

        return x > left && x < right && y > top && y < bottom ? [one.item] : [];
      });
      const base = extent.base.flatMap((index) => {
        const found = byIndex.get(index);

        return found === undefined || inside.includes(found) ? [] : [found];
      });

      app.onSelectMany([...base, ...inside]);
    } else {
      extent = undefined;
      app.onPin(to.item);
    }

    const ceiling =
      root.querySelector(".sticky")!.getBoundingClientRect().bottom + 8;
    const floor = window.innerHeight - 8;

    if (to.rect.top < ceiling) {
      window.scrollBy(0, to.rect.top - ceiling);
    } else if (to.rect.bottom > floor) {
      window.scrollBy(0, to.rect.bottom - floor);
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keydown", onArrowKey);
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keydown", onArrowKey);
  });

  return (
    <ItemMenu find={itemAt} selection={app.selected}>
      <div
        ref={(el: HTMLDivElement) => (root = el)}
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
            selected={app.active()}
            onSelect={app.onCharacter}
          />
          <Show when={vault()}>
            {(store) => (
              <VaultHeader
                store={store()}
                capacity={vaultCapacity()}
                character={shown().find((one) => !one.isVault)}
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
                  <Show when={category === "Postmaster"}>
                    <CollectAll
                      character={shown().find((store) => !store.isVault)}
                      stores={app.stores()}
                      moving={app.moving()}
                      onCollect={app.onCollect}
                    />
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
                                <For each={VAULT_PARTS}>
                                  {(part) => (
                                    <div
                                      class="item-grid wide"
                                      classList={{
                                        favorites: part === "favorites",
                                        hidden: !vaultCell(bucket())[part].some(
                                          (item) => hits().has(item),
                                        ),
                                      }}
                                    >
                                      <For each={vaultCell(bucket())[part]}>
                                        {(item) =>
                                          tile(item, () => vaultOrder(bucket()))
                                        }
                                      </For>
                                    </div>
                                  )}
                                </For>
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
