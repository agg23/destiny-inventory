import { resolveClosure, slimItem } from "@dvm/defs-core";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import type { Artifacts } from "./loader.ts";

export interface RefreshRequest {
  membershipType: number;
  membershipId: string;
  accessToken?: string;
  knownHashes?: number[];
  knownPlugSets?: number[];
}

export interface RefreshResponse {
  manifestVersion: string;
  profile: DestinyProfileResponse;
  defs: {
    items: unknown[];
    plugSets: unknown[];
  };
}

export const ownedHashes = (profile: DestinyProfileResponse): Set<number> => {
  const hashes = new Set<number>();

  for (const item of profile.profileInventory?.data?.items ?? []) {
    hashes.add(item.itemHash);
  }

  for (const inventory of Object.values(profile.characterInventories?.data ?? {})) {
    for (const item of inventory.items) {
      hashes.add(item.itemHash);
    }
  }

  for (const equipment of Object.values(profile.characterEquipment?.data ?? {})) {
    for (const item of equipment.items) {
      hashes.add(item.itemHash);
    }
  }

  return hashes;
};

export const buildRefresh = (
  artifacts: Artifacts,
  profile: DestinyProfileResponse,
  knownHashes: number[] = [],
  knownPlugSets: number[] = [],
): RefreshResponse => {
  const closure = resolveClosure(ownedHashes(profile), artifacts.tables);
  const known = new Set(knownHashes);
  const knownSets = new Set(knownPlugSets);

  const items: unknown[] = [];

  for (const hash of closure.items) {
    if (known.has(hash)) {
      continue;
    }

    const item = artifacts.tables.items[hash];

    if (item) {
      items.push(slimItem(item));
    }
  }

  const plugSets: unknown[] = [];

  for (const hash of closure.plugSets) {
    if (knownSets.has(hash)) {
      continue;
    }

    const plugSet = artifacts.tables.plugSets[hash];

    if (plugSet) {
      plugSets.push(plugSet);
    }
  }

  return {
    manifestVersion: artifacts.version,
    profile,
    defs: { items, plugSets },
  };
};
