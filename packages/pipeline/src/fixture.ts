import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { DestinyItemComponent, DestinyProfileResponse } from "bungie-api-ts/destiny2";

export const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
export const CACHE_ROOT = join(REPO_ROOT, ".cache", "manifest");
export const PROFILE_FIXTURE = join(REPO_ROOT, ".cache", "profile.json");

export const loadProfile = async (): Promise<DestinyProfileResponse | undefined> => {
  if (!existsSync(PROFILE_FIXTURE)) {
    return undefined;
  }

  const body = JSON.parse(await readFile(PROFILE_FIXTURE, "utf8")) as
    | DestinyProfileResponse
    | { Response: DestinyProfileResponse };

  return "Response" in body ? body.Response : body;
};

export const collectItems = (profile: DestinyProfileResponse): DestinyItemComponent[] => {
  const items: DestinyItemComponent[] = [];

  for (const item of profile.profileInventory?.data?.items ?? []) {
    items.push(item);
  }

  for (const inventory of Object.values(profile.characterInventories?.data ?? {})) {
    for (const item of inventory.items) {
      items.push(item);
    }
  }

  for (const equipment of Object.values(profile.characterEquipment?.data ?? {})) {
    for (const item of equipment.items) {
      items.push(item);
    }
  }

  return items;
};
