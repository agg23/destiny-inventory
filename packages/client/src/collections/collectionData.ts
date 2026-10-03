import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource } from "solid-js";

import { useApp } from "../App.tsx";
import {
  acquiredFor,
  catalystFor,
  copiesByKey,
  definedSession,
  ownershipOf,
  primeCollections,
  type Catalyst,
  type Ownership,
  type Weapon,
} from "../collections.ts";
import { fakeItems } from "../fakeItems.ts";
import { dismiss, preview } from "../preview.ts";

export const useCollectionData = () => {
  const app = useApp();

  const [index] = createResource(
    () => definedSession(app.loaded()?.session),
    primeCollections,
  );
  const [acquired] = createResource(
    () => {
      const session = app.loaded()?.session;

      return session === undefined
        ? undefined
        : `${session.membership.membershipId}:${session.minted}`;
    },
    // The key needs a session
    () => acquiredFor(app.loaded()!.session),
  );

  const copies = createMemo(() => copiesByKey(app.stores()));

  const copiesOf = (weapon: Weapon): DimItem[] =>
    copies().get(weapon.key) ?? [];

  const ownership = (weapon: Weapon): Ownership | undefined =>
    ownershipOf(weapon, copies().get(weapon.key), acquired.latest);

  const catalyst = (weapon: Weapon): Catalyst | undefined =>
    catalystFor(weapon, app.loaded()?.records ?? {});

  return { index, acquired, copiesOf, ownership, catalyst };
};

export type CollectionData = ReturnType<typeof useCollectionData>;

const cardNotes = (data: CollectionData, weapon: Weapon): string[] => {
  const notes: string[] = [];
  const ownership = data.ownership(weapon);
  const copies = data.copiesOf(weapon).length;

  if (ownership === "neverseen") {
    notes.push("Never seen");
  } else if (ownership !== undefined) {
    notes.push("Unlocked");
  }

  if (copies > 0) {
    notes.push(`${copies} owned`);
  }

  return notes;
};

/** Builds the definition item on first hover, then opens the card if still hovered */
export const useWeaponPreview = (data: CollectionData) => {
  const app = useApp();

  let hovered: number | undefined = undefined;
  let shown: DimItem | undefined = undefined;

  const enter = (weapon: Weapon, element: HTMLElement) => {
    const loaded = app.loaded();

    if (!loaded) {
      return;
    }

    hovered = weapon.newestItemHash;

    void fakeItems(loaded, [weapon.newestItemHash]).then((built) => {
      const item = built.get(weapon.newestItemHash);

      if (item && hovered === weapon.newestItemHash) {
        shown = item;
        preview(
          item,
          element,
          undefined,
          undefined,
          false,
          cardNotes(data, weapon),
        );
      }
    });
  };

  const leave = () => {
    hovered = undefined;

    if (shown) {
      dismiss(shown);
      shown = undefined;
    }
  };

  return { enter, leave };
};
