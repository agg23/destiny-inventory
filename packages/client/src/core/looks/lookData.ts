import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { lookAssetShard, type LookAsset, type LookItem } from "@dvm/defs-core";

import { fetchRecords, fetchTable } from "../api/artifacts.ts";
import { cached } from "../api/cache.ts";
import { loadConfig } from "../api/config.ts";
import { CURRENT } from "../profile/load.ts";
import type { Session } from "../profile/loadTypes.ts";
import { PROFILE } from "../profile/store.ts";

export const lookItems = cached(async (): Promise<LookItem[]> => {
  const { artifacts } = await loadConfig();

  return fetchRecords<LookItem>(artifacts, "LookItem");
});

const shards = new Map<string, Promise<Record<number, LookAsset>>>();

export const fetchLookAsset = async (hash: number): Promise<LookAsset> => {
  const name = lookAssetShard(hash);
  let shard = shards.get(name);

  if (!shard) {
    const pending = loadConfig().then(({ artifacts }) =>
      fetchTable<Record<number, LookAsset>>(artifacts, name),
    );

    pending.catch(() => {
      if (shards.get(name) === pending) {
        shards.delete(name);
      }
    });
    shards.set(name, pending);
    shard = pending;
  }

  const asset = (await shard)[hash];

  if (!asset) {
    throw new Error(`No model for item ${hash}`);
  }

  return asset;
};

/** Shaders and ornaments any character can socket, from the stored profile */
export const unlockedPlugs = async (session: Session): Promise<Set<number>> => {
  const profile = await session.store.getOne<DestinyProfileResponse>(
    PROFILE,
    CURRENT,
  );
  const unlocked = new Set<number>();
  const plugSets = [
    profile?.profilePlugSets?.data,
    ...Object.values(profile?.characterPlugSets?.data ?? {}),
  ];

  for (const component of plugSets) {
    for (const plugs of Object.values(component?.plugs ?? {})) {
      for (const plug of plugs) {
        // canInsert also fails for reasons other than locked
        if (plug.enabled) {
          unlocked.add(plug.plugItemHash);
        }
      }
    }
  }

  return unlocked;
};
