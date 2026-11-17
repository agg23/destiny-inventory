import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, onCleanup } from "solid-js";

import { clear } from "../items/preview.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import type { Url } from "../router.ts";

export const createSelection = (
  url: Url,
  stores: () => DimStore[],
  current: () => LoadResult | undefined,
) => {
  let anchor: string | undefined = undefined;

  const selectedIds = () => url.get("pin");

  const selectedSet = createMemo(() => new Set(selectedIds()));

  const held = createMemo(
    () =>
      new Map(
        stores().flatMap((store) => store.items.map((one) => [one.id, one])),
      ),
  );

  const resolve = (ids: string[]) =>
    ids.flatMap((id) => {
      const found = held().get(id);

      return found === undefined ? [] : [found];
    });

  const selected = createMemo(() => resolve(selectedIds()));

  const pinned = createMemo(() => {
    const chosen = selected();

    return chosen.length === 1 ? chosen : [];
  });

  const compared = createMemo(() => (url.get("compare") ? selected() : []));

  // The profile may not have loaded these items yet
  const awaitingPins = () =>
    url.get("pin").length > 0 && selected().length === 0 && !current();

  // Only single pins get history entries
  const select = (ids: string[]) => {
    const was = url.get("pin");

    if (was.length === ids.length && was.every((id, at) => id === ids[at])) {
      return;
    }

    const patch =
      ids.length === 0 ? { pin: ids, compare: false } : { pin: ids };

    if (was.length > 1 || ids.length > 1) {
      url.replace(patch);
    } else {
      url.push(patch);
    }
  };

  const pin = (item: DimItem) => {
    const ids = selectedIds();

    anchor = item.id;
    select(ids.length === 1 && ids[0] === item.id ? [] : [item.id]);
  };

  // DIM gives every uninstanced item the id "0"
  const toggle = (item: DimItem) => {
    if (item.id === "0") {
      pin(item);

      return;
    }

    const ids = selectedIds();

    anchor = item.id;
    select(
      ids.includes(item.id)
        ? ids.filter((id) => id !== item.id)
        : [...ids, item.id],
    );
  };

  const extend = (item: DimItem, order: DimItem[]) => {
    const from = order.findIndex((one) => one.id === anchor);
    const to = order.findIndex((one) => one.id === item.id);

    if (from < 0 || to < 0 || item.id === "0") {
      toggle(item);

      return;
    }

    const ids = selectedIds();
    const span = order
      .slice(Math.min(from, to), Math.max(from, to) + 1)
      .map((one) => one.id)
      .filter((id) => id !== "0" && !ids.includes(id));

    select([...ids, ...span]);
  };

  const selectMany = (items: DimItem[]) => {
    anchor = undefined;
    select(items.flatMap((one) => (one.id === "0" ? [] : [one.id])));
  };

  const unpin = (item: DimItem) => {
    select(selectedIds().filter((id) => id !== item.id));
  };

  const unpinAll = () => {
    anchor = undefined;

    if (selectedIds().length > 0) {
      select([]);
    }
  };

  // Kobalte marks the Escape that closes a menu
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      clear();
      unpinAll();
    }
  };

  const compare = (items: DimItem[]) => {
    anchor = undefined;
    url.push({ pin: items.map((one) => one.id), compare: true });
  };

  const closeCompare = () => {
    url.replace({ compare: false });
  };

  const onBackground = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (
      !target.closest(".item-tile, .rail, [data-menu], [data-compare], header")
    ) {
      unpinAll();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

  return {
    selectedSet,
    selected,
    pinned,
    compared,
    awaitingPins,
    pin,
    toggle,
    extend,
    selectMany,
    unpin,
    unpinAll,
    compare,
    closeCompare,
    onBackground,
  };
};
