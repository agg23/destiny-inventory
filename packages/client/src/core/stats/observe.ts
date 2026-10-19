import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import type {
  DestinyItemComponent,
  DestinyItemReusablePlugsComponent,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";
import { SocketCategoryHashes } from "data/d2/generated-enums";

import { inGame, profileItems } from "../profile/profileReads.ts";
import {
  SNAPSHOT_KEYS,
  type Change,
  type HeldItem,
  type ItemSnapshot,
  type Observed,
} from "./types.ts";

const addTo = (into: Record<number, number>, item: DestinyItemComponent) => {
  into[item.itemHash] = (into[item.itemHash] ?? 0) + item.quantity;
};

export const observe = (
  profile: DestinyProfileResponse,
  accountWide: (progressionHash: number) => boolean,
): Observed => {
  const minted = new Date(profile.responseMintedTimestamp ?? 0).getTime();
  const items: Record<string, HeldItem> = {};
  const stacks: Record<number, number> = {};
  const currencies: Record<number, number> = {};
  const objectives: Observed["objectives"] = {};
  const progressions: Record<number, number> = {};
  const power: Record<string, number> = {};
  const equipped: Observed["equipped"] = {};
  const activities: Observed["activities"] = {};

  const hold = (
    item: DestinyItemComponent,
    characterId: string | undefined,
  ) => {
    if (item.itemInstanceId === undefined) {
      addTo(stacks, item);

      return;
    }

    items[item.itemInstanceId] = {
      itemHash: item.itemHash,
      characterId,
      bucketHash: item.bucketHash,
    };
  };

  for (const item of profile.profileInventory?.data?.items ?? []) {
    hold(item, undefined);
  }

  for (const [id, held] of Object.entries(
    profile.characterInventories?.data ?? {},
  )) {
    for (const item of held.items) {
      hold(item, id);
    }
  }

  for (const [id, held] of Object.entries(
    profile.characterEquipment?.data ?? {},
  )) {
    for (const item of held.items) {
      hold(item, id);

      if (item.itemInstanceId !== undefined) {
        equipped[`${id}/${item.bucketHash}`] = {
          instanceId: item.itemInstanceId,
          itemHash: item.itemHash,
        };
      }
    }
  }

  for (const item of profile.profileCurrencies?.data?.items ?? []) {
    addTo(currencies, item);
  }

  for (const [instanceId, held] of Object.entries(
    profile.itemComponents?.plugObjectives?.data ?? {},
  )) {
    const itemHash = items[instanceId]?.itemHash;

    if (itemHash === undefined) {
      continue;
    }

    for (const progress of Object.values(held.objectivesPerPlug).flat()) {
      objectives[`${instanceId}/${progress.objectiveHash}`] = {
        itemHash,
        progress: progress.progress ?? 0,
      };
    }
  }

  for (const held of Object.values(profile.characterProgressions?.data ?? {})) {
    for (const progression of Object.values(held.progressions)) {
      if (accountWide(progression.progressionHash)) {
        progressions[progression.progressionHash] = progression.currentProgress;
      }
    }
  }

  for (const [id, character] of Object.entries(
    profile.characters?.data ?? {},
  )) {
    power[id] = character.light;
  }

  for (const [id, activity] of Object.entries(
    profile.characterActivities?.data ?? {},
  )) {
    if (!inGame(profile, id, minted)) {
      activities[id] = {
        activityHash: 0,
        modeHash: 0,
        playlistHash: 0,
        startedAt: 0,
      };

      continue;
    }

    activities[id] = {
      activityHash: activity.currentActivityHash,
      modeHash: activity.currentActivityModeHash,
      playlistHash: activity.currentPlaylistActivityHash ?? 0,
      startedAt: new Date(activity.dateActivityStarted).getTime(),
    };
  }

  return {
    minted,
    items,
    stacks,
    currencies,
    objectives,
    progressions,
    power,
    equipped,
    activities,
  };
};

const splitKey = (key: string): [string, number] => {
  const [left, right] = key.split("/");

  return [left!, Number(right)];
};

/** Everything that differs between two observations, stamped with their mint window */
export const diff = (was: Observed, now: Observed): Change[] => {
  const window = { from: was.minted, at: now.minted };
  const changes: Change[] = [];

  for (const [instanceId, held] of Object.entries(now.items)) {
    if (!(instanceId in was.items)) {
      changes.push({
        ...window,
        kind: "item",
        instanceId,
        ...held,
        added: true,
      });
    }
  }

  for (const [instanceId, held] of Object.entries(was.items)) {
    if (!(instanceId in now.items)) {
      changes.push({
        ...window,
        kind: "item",
        instanceId,
        ...held,
        added: false,
      });
    }
  }

  // An emptied stack drops out of the profile
  for (const kind of ["stack", "currency"] as const) {
    const before = kind === "stack" ? was.stacks : was.currencies;
    const after = kind === "stack" ? now.stacks : now.currencies;
    const hashes = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of hashes) {
      const itemHash = Number(key);
      const from = before[itemHash] ?? 0;
      const to = after[itemHash] ?? 0;

      if (from !== to) {
        changes.push({ ...window, kind, itemHash, before: from, after: to });
      }
    }
  }

  // New and dismantled items already show as item changes
  for (const [key, held] of Object.entries(now.objectives)) {
    const previous = was.objectives[key];

    if (previous && previous.progress !== held.progress) {
      const [instanceId, objectiveHash] = splitKey(key);

      changes.push({
        ...window,
        kind: "objective",
        instanceId,
        itemHash: held.itemHash,
        objectiveHash,
        before: previous.progress,
        after: held.progress,
      });
    }
  }

  for (const [key, progress] of Object.entries(now.progressions)) {
    const progressionHash = Number(key);
    const previous = was.progressions[progressionHash];

    if (previous !== undefined && previous !== progress) {
      changes.push({
        ...window,
        kind: "progression",
        progressionHash,
        before: previous,
        after: progress,
      });
    }
  }

  for (const [characterId, light] of Object.entries(now.power)) {
    const previous = was.power[characterId];

    if (previous !== undefined && previous !== light) {
      changes.push({
        ...window,
        kind: "power",
        characterId,
        before: previous,
        after: light,
      });
    }
  }

  for (const [key, held] of Object.entries(now.equipped)) {
    if (was.equipped[key]?.instanceId !== held.instanceId) {
      const [characterId, bucketHash] = splitKey(key);

      changes.push({
        ...window,
        kind: "equip",
        characterId,
        bucketHash,
        ...held,
      });
    }
  }

  for (const [characterId, held] of Object.entries(now.activities)) {
    const previous = was.activities[characterId];

    if (
      previous?.activityHash !== held.activityHash ||
      previous.startedAt !== held.startedAt
    ) {
      changes.push({
        ...window,
        kind: "activity",
        characterId,
        ...held,
        // Leaving the game has no start of its own
        startedAt: held.activityHash === 0 ? now.minted : held.startedAt,
      });
    }
  }

  return changes;
};

// Their options are the account's unlocks, the same on every item
const UNLOCK_CATEGORIES = new Set<number>([
  SocketCategoryHashes.WeaponMods,
  SocketCategoryHashes.ArmorMods,
  SocketCategoryHashes.GhostMods,
  SocketCategoryHashes.GhostShellMods,
  SocketCategoryHashes.WeaponCosmetics,
  SocketCategoryHashes.ArmorCosmetics,
  SocketCategoryHashes.GhostCosmetics,
]);

/** The item and its instance components, as they stand in this profile. Mod and cosmetic plug options are left out */
export const snapshotOf = (
  profile: DestinyProfileResponse,
  instanceId: string,
  defs: D2ManifestDefinitions | undefined,
): ItemSnapshot | undefined => {
  const item = profileItems(profile).find(
    (one) => one.itemInstanceId === instanceId,
  );

  if (!item) {
    return undefined;
  }

  const components: ItemSnapshot["components"] = {};

  for (const key of SNAPSHOT_KEYS) {
    const entry: unknown = profile.itemComponents?.[key]?.data?.[instanceId];

    if (entry !== undefined) {
      components[key] = entry;
    }
  }

  const reusable = components.reusablePlugs as
    | DestinyItemReusablePlugsComponent
    | undefined;
  const categories =
    defs?.InventoryItem.getOptional(item.itemHash)?.sockets?.socketCategories ??
    [];
  const unlocked = new Set(
    categories
      .filter((category) => UNLOCK_CATEGORIES.has(category.socketCategoryHash))
      .flatMap((category) => category.socketIndexes),
  );

  // makeItem falls back to the def's plug set
  if (reusable && unlocked.size > 0) {
    components.reusablePlugs = {
      plugs: Object.fromEntries(
        Object.entries(reusable.plugs).filter(
          ([index]) => !unlocked.has(Number(index)),
        ),
      ),
    };
  }

  return { item, components };
};
