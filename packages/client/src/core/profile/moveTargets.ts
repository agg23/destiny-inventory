import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  amountOfItem,
  getCurrentStore,
  getVault,
  potentialSpaceLeftForItem,
} from "app/inventory/stores-helpers";
import { isClassCompatible, itemCanBeEquippedBy } from "app/utils/item-utils";
import { BucketHashes } from "data/d2/generated-enums";

import { unmovable } from "../items/compare.ts";

const VAULTABLE_BUCKETS = new Set<number>([
  BucketHashes.KineticWeapons,
  BucketHashes.EnergyWeapons,
  BucketHashes.PowerWeapons,
  BucketHashes.Helmet,
  BucketHashes.Gauntlets,
  BucketHashes.ChestArmor,
  BucketHashes.LegArmor,
  BucketHashes.ClassArmor,
  BucketHashes.Ghost,
  BucketHashes.Vehicle,
  BucketHashes.Ships,
]);

/** Gear that moves in and out of the vault, leaving out consumables and mods */
export const vaultable = (item: DimItem): boolean =>
  VAULTABLE_BUCKETS.has(item.bucket.hash);

export const storeLabel = (store: DimStore): string =>
  store.isVault ? "Vault" : store.className;

const inPostmaster = (item: DimItem): boolean =>
  item.location.hash === BucketHashes.LostItems;

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
    return getVault(stores);
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

/** The items in a selection that can go to the target */
export const movableTo = (
  items: DimItem[],
  stores: DimStore[],
  active: DimStore | undefined,
  target: DimStore,
): DimItem[] =>
  items.filter(
    (item) =>
      transferTargets(item, stores, active).some(
        (store) => store.id === target.id,
      ) && !transferBlocked(item, stores, target),
  );

/** Why none of a selection can go to the target */
export const bulkBlocked = (
  items: DimItem[],
  stores: DimStore[],
  active: DimStore | undefined,
  target: DimStore,
): string | undefined =>
  movableTo(items, stores, active, target).length === 0
    ? "Nothing to move"
    : undefined;

/** The stores besides the primary target, for a split button's menu */
export const otherStores = (
  stores: DimStore[],
  primary: DimStore,
): DimStore[] => stores.filter((store) => store.id !== primary.id);

/** The vault, unless the whole selection is already there */
export const defaultBulkTransfer = (
  items: DimItem[],
  stores: DimStore[],
  active: DimStore | undefined,
): DimStore | undefined => {
  const vault = getVault(stores);

  if (items.some((item) => item.owner !== vault?.id)) {
    return vault;
  }

  return active ?? stores.find((store) => !store.isVault);
};
