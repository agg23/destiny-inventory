import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource } from "solid-js";

import { useApp } from "../../core/app/state.ts";
import {
  definedSession,
  primeCollections,
} from "../../core/collections/collections.ts";
import {
  acquiredFor,
  catalystFor,
  copiesByKey,
  ownershipOf,
} from "../../core/collections/ownership.ts";
import type {
  Catalyst,
  Cosmetic,
  Entry,
  Ownership,
} from "../../core/collections/types.ts";
import { dismiss, preview } from "../../core/items/preview.ts";
import { fakeItems } from "../../core/profile/fakeItems.ts";

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
        : `${session.membership.membershipId}:${session.builtFrom}`;
    },
    // The key needs a session
    () => acquiredFor(app.loaded()!.session),
  );

  const copies = createMemo(() => copiesByKey(app.stores()));

  const copiesOf = (entry: Entry | Cosmetic): DimItem[] =>
    copies().get(entry.key) ?? [];

  const ownership = (entry: Entry): Ownership | undefined =>
    ownershipOf(entry, copies().get(entry.key), acquired.latest);

  const catalyst = (entry: Entry | Cosmetic): Catalyst | undefined =>
    catalystFor(entry, app.loaded()?.records ?? {});

  const lastPlayedClass = (): number =>
    app.stores().find((store) => store.current)?.classType ?? 0;

  return { index, acquired, copiesOf, ownership, catalyst, lastPlayedClass };
};

export type CollectionData = ReturnType<typeof useCollectionData>;

export const entryNotes = (
  ownership: Ownership | undefined,
  copies: number,
): string[] => {
  const notes: string[] = [];

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
export const useEntryPreview = () => {
  const app = useApp();

  let hovered: number | undefined = undefined;
  let shown: DimItem | undefined = undefined;

  const enter = (entry: Entry, element: HTMLElement, notes: string[]) => {
    const loaded = app.loaded();

    if (!loaded) {
      return;
    }

    hovered = entry.newestItemHash;

    void fakeItems(loaded, [entry.newestItemHash]).then((built) => {
      const item = built.get(entry.newestItemHash);

      if (item && hovered === entry.newestItemHash) {
        shown = item;
        preview(item, element, { notes });
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
