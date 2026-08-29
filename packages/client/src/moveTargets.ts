import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  amountOfItem,
  getCurrentStore,
  potentialSpaceLeftForItem,
} from "app/inventory/stores-helpers";
import { isClassCompatible, itemCanBeEquippedBy } from "app/utils/item-utils";

import { unmovable } from "./compare.ts";

// BucketHashes.LostItems, inlined
export const LOST_ITEMS = 215593132;

export const storeLabel = (store: DimStore): string =>
  store.isVault ? "Vault" : store.className;

const inPostmaster = (item: DimItem): boolean =>
  item.location.hash === LOST_ITEMS;

const noRoom = (
  item: DimItem,
  stores: DimStore[],
  target: DimStore,
): string | undefined => {
  const space = potentialSpaceLeftForItem(target, item, stores);

  if (space.guaranteed > 0) {
    return undefined;
  }

  // Account-wide buckets live on the current character
  const holder =
    item.bucket.accountWide && !target.isVault
      ? getCurrentStore(stores)
      : target;

  if (
    item.uniqueStack &&
    holder &&
    amountOfItem(holder, item) >= item.maxStackSize
  ) {
    return `${storeLabel(target)} already holds the maximum`;
  }

  return space.couldMakeSpace ? undefined : `No room in ${storeLabel(target)}`;
};

export const pullBlocked = (item: DimItem): string | undefined => {
  if (unmovable(item)) {
    return "Cannot be pulled from the Postmaster";
  }

  if (inPostmaster(item) && !item.canPullFromPostmaster) {
    return "Cannot be pulled from the Postmaster";
  }

  return undefined;
};

export const transferBlocked = (
  item: DimItem,
  stores: DimStore[],
  target: DimStore,
): string | undefined => {
  const pull = pullBlocked(item);

  if (pull) {
    return pull;
  }

  if (inPostmaster(item)) {
    return noRoom(item, stores, target);
  }

  if (item.notransfer) {
    return "Cannot be transferred";
  }

  return noRoom(item, stores, target);
};

const holders = (
  item: DimItem,
  stores: DimStore[],
  active: DimStore | undefined,
): DimStore[] => {
  const compatible = stores.filter(
    (store) => store.isVault || isClassCompatible(item.classType, store.classType),
  );

  if (!inPostmaster(item)) {
    return compatible;
  }

  return compatible.filter(
    (store) => store.isVault || store.id === active?.id,
  );
};

export const transferTargets = (
  item: DimItem,
  stores: DimStore[],
  active: DimStore | undefined,
): DimStore[] => {
  const elsewhere = holders(item, stores, active).filter(
    (store) => store.id !== item.owner && !item.notransfer,
  );
  const home = stores.find((store) => store.id === item.owner);

  // A pull lands on the owning character, transferable or not
  if (inPostmaster(item) && home && home.id === active?.id) {
    return [home, ...elsewhere];
  }

  return elsewhere;
};

export const defaultTransfer = (
  item: DimItem,
  stores: DimStore[],
  active: DimStore | undefined,
): DimStore | undefined => {
  const home = stores.find((store) => store.id === item.owner);

  if (inPostmaster(item)) {
    return transferTargets(item, stores, active)[0];
  }

  if (!home?.isVault) {
    return stores.find((store) => store.isVault);
  }

  const characters = holders(item, stores, active).filter(
    (store) => !store.isVault,
  );

  if (active && characters.some((store) => store.id === active.id)) {
    return active;
  }

  return characters[0];
};

export const equipTargets = (
  item: DimItem,
  stores: DimStore[],
  active: DimStore | undefined,
): DimStore[] => {
  const targets = stores.filter(
    (store) =>
      !store.isVault &&
      itemCanBeEquippedBy(item, store, true) &&
      !(item.equipped && item.owner === store.id),
  );

  if (!inPostmaster(item)) {
    return targets;
  }

  return targets.filter((store) => store.id === active?.id);
};

export const defaultEquip = (
  item: DimItem,
  stores: DimStore[],
  active: DimStore | undefined,
): DimStore | undefined => {
  const targets = equipTargets(item, stores, active);

  if (active && targets.some((store) => store.id === active.id)) {
    return active;
  }

  return targets[0];
};
