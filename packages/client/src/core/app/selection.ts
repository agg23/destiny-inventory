import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { comparable } from "../items/compare.ts";
import { clear } from "../items/preview.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import type { Url } from "../router.ts";
import type { Tab } from "../url.ts";

const PINS = 2;

export const createSelection = (
  url: Url,
  tab: () => Tab,
  stores: () => DimStore[],
  current: () => LoadResult | undefined,
) => {
  // Big selections stay out of the URL
  const [bulk, setBulk] = createSignal<string[]>([]);
  let anchor: string | undefined = undefined;

  createEffect(
    on(
      () => url.get("pin"),
      (ids) => {
        if (ids.length > 0) {
          setBulk([]);
        }
      },
      { defer: true },
    ),
  );

  // Tab links drop pins
  createEffect(on(tab, () => setBulk([]), { defer: true }));

  const selectedIds = createMemo(() =>
    bulk().length > 0 ? bulk() : url.get("pin"),
  );

  const selectedSet = createMemo(() => new Set(selectedIds()));

  const selected = createMemo(() => {
    const held = new Map(
      stores().flatMap((store) => store.items.map((one) => [one.id, one])),
    );

    return selectedIds().flatMap((id) => {
      const found = held.get(id);

      return found === undefined ? [] : [found];
    });
  });

  const pinned = createMemo(() => {
    const chosen = selected();
    const [first, second] = chosen;

    if (chosen.length === 1) {
      return chosen;
    }

    if (chosen.length === 2 && comparable(first!, second!)) {
      return chosen;
    }

    return [];
  });

  // The profile may not have loaded these items yet
  const awaitingPins = () =>
    url.get("pin").length > 0 && selected().length === 0 && !current();

  const select = (ids: string[]) => {
    if (ids.length > PINS) {
      setBulk(ids);

      if (url.get("pin").length > 0) {
        url.replace({ pin: [] });
      }

      return;
    }

    const was = url.get("pin");

    setBulk([]);

    if (was.length !== ids.length || was.some((id, at) => id !== ids[at])) {
      url.push({ pin: ids });
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

  const onBackground = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (!target.closest(".item-tile, .rail, [data-menu], header")) {
      unpinAll();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

  return {
    selectedSet,
    selected,
    pinned,
    awaitingPins,
    pin,
    toggle,
    extend,
    selectMany,
    unpin,
    unpinAll,
    onBackground,
  };
};
