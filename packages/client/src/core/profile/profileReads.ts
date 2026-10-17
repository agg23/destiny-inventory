import type {
  DestinyItemComponentSetOfint64,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { MINUTE } from "../time.ts";
import type {
  CharacterRecords,
  LoadResult,
  OrderRewards,
  Session,
  StringVariables,
} from "./loadTypes.ts";
import { movesSettledAt } from "./moves.ts";

// The seasonal hub's challenges are character scoped, the lifetime counters are not
export const characterRecords = (profile: DestinyProfileResponse): CharacterRecords => {
  const shared = profile.profileRecords?.data?.records ?? {};
  const rows: CharacterRecords = {};

  for (const [id, held] of Object.entries(
    profile.characterRecords?.data ?? {},
  )) {
    rows[id] = { ...shared, ...held.records };
  }

  return rows;
};

export const orderRewards = (profile: DestinyProfileResponse): OrderRewards => {
  const rows: OrderRewards = {};

  for (const [id, held] of Object.entries(
    profile.characterProgressions?.data ?? {},
  )) {
    rows[id] = held.unclaimedOrderRewards ?? {};
  }

  return rows;
};

export const stringVariables = (profile: DestinyProfileResponse): StringVariables => {
  const shared =
    profile.profileStringVariables?.data?.integerValuesByHash ?? {};
  const rows: StringVariables = {};

  for (const [id, held] of Object.entries(
    profile.characterStringVariables?.data ?? {},
  )) {
    rows[id] = { ...shared, ...held.integerValuesByHash };
  }

  return rows;
};

// Only field that says which response is newer
export const mintedAt = (profile: DestinyProfileResponse): number =>
  new Date(profile.responseMintedTimestamp ?? 0).getTime();

// Change between mints without changing any item
const VOLATILE_KEYS = new Set([
  "responseMintedTimestamp",
  "secondaryComponentsMintedTimestamp",
  "characterActivities",
  "profileStringVariables",
  "characterStringVariables",
  "minutesPlayedThisSession",
  "minutesPlayedTotal",
]);

export const contentsOf = (profile: DestinyProfileResponse): string =>
  JSON.stringify(profile, (key, value: unknown) =>
    VOLATILE_KEYS.has(key) ? undefined : value,
  );

// Rebuild after a move even if the profile matches
export const sameContents = (session: Session, contents: string): boolean =>
  contents === session.contents && movesSettledAt() < session.builtFrom;

// Bungie's cache can hand back stale data
export const isStale = (session: Session, minted: number): boolean =>
  minted <= Math.max(session.minted, movesSettledAt());

export const ageOf = (minted: number): string =>
  `${((Date.now() - minted) / 1000).toFixed(1)}s`;

const LIVE_WINDOW = 10 * MINUTE;

// currentActivityHash sits stale after a logout
export const playingNow = (profile: DestinyProfileResponse): string | undefined => {
  const characters = profile.characters?.data ?? {};
  const now = Date.now();

  for (const [id, activity] of Object.entries(
    profile.characterActivities?.data ?? {},
  )) {
    const lastPlayed = new Date(characters[id]?.dateLastPlayed ?? 0).getTime();

    if (activity.currentActivityHash !== 0 && now - lastPlayed < LIVE_WINDOW) {
      return id;
    }
  }

  return undefined;
};

export const profileItems = (profile: DestinyProfileResponse) => [
  ...(profile.profileInventory?.data?.items ?? []),
  ...Object.values(profile.characterInventories?.data ?? {}).flatMap(
    (i) => i.items,
  ),
  ...Object.values(profile.characterEquipment?.data ?? {}).flatMap(
    (e) => e.items,
  ),
];

/** Every plug an item component set names, socketed or reusable */
export const componentPlugHashes = (
  set:
    | Pick<DestinyItemComponentSetOfint64, "sockets" | "reusablePlugs">
    | undefined,
): number[] => {
  const hashes: number[] = [];

  for (const item of Object.values(set?.sockets?.data ?? {})) {
    for (const socket of item.sockets) {
      if (socket.plugHash !== undefined) {
        hashes.push(socket.plugHash);
      }
    }
  }

  for (const item of Object.values(set?.reusablePlugs?.data ?? {})) {
    for (const plugs of Object.values(item.plugs)) {
      for (const plug of plugs) {
        hashes.push(plug.plugItemHash);
      }
    }
  }

  return hashes;
};

// Crafted and enhanced perks sit outside the plug set
export const liveReferences = (profile: DestinyProfileResponse): number[] => {
  const hashes = componentPlugHashes(profile.itemComponents);
  const plugSets = [
    ...Object.values(profile.characterPlugSets?.data ?? {}),
    profile.profilePlugSets?.data,
  ];

  for (const component of plugSets) {
    for (const plugs of Object.values(component?.plugs ?? {})) {
      for (const plug of plugs) {
        hashes.push(plug.plugItemHash);
      }
    }
  }

  return hashes;
};

export type LiveFields = Pick<
  LoadResult,
  "source" | "playing" | "activities" | "variables" | "records" | "orderRewards"
>;

/** The LoadResult fields read straight off a live profile */
export const liveFields = (profile: DestinyProfileResponse): LiveFields => ({
  source: "live",
  playing: playingNow(profile),
  activities: profile.characterActivities?.data ?? {},
  variables: stringVariables(profile),
  records: characterRecords(profile),
  orderRewards: orderRewards(profile),
});
