import type { DimStore } from "app/inventory/store-types";
import type { Navigator } from "@solidjs/router";
import { createSignal } from "solid-js";

import {
  collectionFilter,
  queryName,
  setQuery,
} from "../../collections/shared/collectionSearch.ts";
import { bySlot, setsOf } from "../collections/armorSets.ts";
import {
  collections,
  definedSession,
  primeCollections,
  rankByName,
} from "../collections/collections.ts";
import {
  acquiredFor,
  catalystFor,
  copiesByKey,
  ownershipOf,
} from "../collections/ownership.ts";
import type { ArmorSet, Entry, EntryFacts } from "../collections/types.ts";
import { messageOf } from "../error.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import type { Url } from "../router.ts";
import { showToast } from "../toast.ts";
import { collectionsHref } from "../url.ts";

export const createEntrySearch = (
  current: () => LoadResult | undefined,
  stores: () => DimStore[],
  url: Url,
  navigate: Navigator,
) => {
  const [weaponsAcquired, setWeaponsAcquired] = createSignal<
    Set<number> | undefined
  >(undefined);

  const primeWeapons = () => {
    const session = definedSession(current()?.session);

    if (!session) {
      return;
    }

    primeCollections(session).catch((e: unknown) =>
      showToast(messageOf(e), "danger"),
    );
    acquiredFor(session)
      .then(setWeaponsAcquired)
      // Status terms just won't match
      .catch(() => undefined);
  };

  const entryMatches = (query: string): (Entry | ArmorSet)[] => {
    const built = collections();
    const name = queryName(query);

    if (!built || name.length < 2) {
      return [];
    }

    const copies = copiesByKey(stores());
    const records = current()?.records ?? {};
    const lastPlayedClass =
      stores().find((store) => store.current)?.classType ?? 0;
    const facts: EntryFacts = {
      ownership: (entry) =>
        ownershipOf(entry, copies.get(entry.key), weaponsAcquired()),
      catalyst: (entry) => catalystFor(entry, records),
    };
    const weaponTest = collectionFilter(built, "weapon", query, facts);
    const armorTest = collectionFilter(built, "armor", query, facts);
    const armor = built.armor.filter(armorTest);
    const playedSets = new Set(
      armor.flatMap((piece) =>
        piece.classType === lastPlayedClass && piece.setName !== undefined
          ? [piece.setName]
          : [],
      ),
    );

    const others = armor.filter(
      (piece) =>
        piece.classType !== lastPlayedClass &&
        (piece.setName === undefined || !playedSets.has(piece.setName)),
    );

    const ranked = [
      ...rankByName<Entry>(
        [
          ...built.weapons.filter(weaponTest),
          ...armor.filter((piece) => piece.classType === lastPlayedClass),
        ],
        name,
      ),
      ...rankByName<Entry>(others, name),
    ];
    const sets = setsOf(ranked);
    const collapsed = new Set<string>();

    return ranked.flatMap((entry): (Entry | ArmorSet)[] => {
      if (
        entry.kind !== "armor" ||
        entry.setKey === undefined ||
        entry.setName === undefined
      ) {
        return [entry];
      }

      const pieces = sets.get(entry.setKey) ?? [];

      if (pieces.length < 2) {
        return [entry];
      }

      if (collapsed.has(entry.setKey)) {
        return [];
      }

      collapsed.add(entry.setKey);

      return [
        {
          kind: "set",
          name: entry.setName,
          rarity: entry.rarity,
          icon: bySlot(pieces)[0]?.icon ?? entry.icon,
          classType: entry.classType,
        },
      ];
    });
  };

  const openSet = (set: ArmorSet) =>
    navigate(
      collectionsHref("/collections", {
        kind: "armor",
        layout: url.get("layout"),
        q: setQuery(set),
      }),
    );

  return { primeWeapons, entryMatches, openSet };
};
