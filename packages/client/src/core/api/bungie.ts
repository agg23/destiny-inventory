import type {
  DestinyActivityHistoryResults,
  DestinyHistoricalStatsPeriodGroup,
  DestinyPostGameCarnageReportData,
  DestinyProfileResponse,
  DestinyVendorResponse,
  DestinyVendorsResponse,
  ServerResponse,
} from "bungie-api-ts/destiny2";

import { readStored, writeStored } from "../storage.ts";
import { loadConfig } from "./config.ts";

export const BUNGIE = "https://www.bungie.net";

const PLATFORM = "https://www.bungie.net/Platform";

// www.bungie.net answers a PGCR request with a bare 301 and no body
const STATS = "https://stats.bungie.net/Platform";

const PAGE = 250;

const COMPONENTS = [
  // 100 dateLastPlayed, 202 unclaimed order payouts, 204 CharacterActivities, 301 order
  // progress, 900 seasonal hub challenges, 1200 StringVariables
  100,
  102, 103, 200, 201, 202, 204, 205, 300, 301, 302, 304, 305, 306, 307, 308,
  309, 310, 900, 1200,
];

export interface Membership {
  membershipType: number;
  membershipId: string;
}

const send = async <T>(
  url: string,
  headers: Record<string, string>,
  init: RequestInit,
): Promise<T> => {
  const { apiKey } = await loadConfig();

  const response = await fetch(url, {
    ...init,
    headers: { "X-API-Key": apiKey, ...headers },
  });

  const body = (await response.json()) as ServerResponse<T>;

  if (body.ErrorCode !== 1) {
    throw new Error(`Bungie ${body.ErrorStatus}: ${body.Message}`);
  }

  return body.Response;
};

const call = <T>(
  path: string,
  accessToken: string,
  host = PLATFORM,
  cache: RequestCache = "default",
): Promise<T> =>
  send<T>(
    `${host}${path}`,
    { Authorization: `Bearer ${accessToken}` },
    { cache },
  );

interface UserMemberships {
  destinyMemberships: Membership[];
  primaryMembershipId?: string;
}

interface CrossSaved extends Membership {
  crossSaveOverride: number;
}

interface SearchResult {
  bungieGlobalDisplayName: string;
  bungieGlobalDisplayNameCode?: number;
  destinyMemberships: CrossSaved[];
}

export interface Player {
  name: string;
  code: number | undefined;
  membership: Membership;
}

// Cross save puts every character on one account
const played = (memberships: CrossSaved[]): Membership | undefined =>
  memberships.find((one) => one.crossSaveOverride === one.membershipType) ??
  memberships[0];

/** Bungie name prefix search, capped at 20 players */
export const searchPlayers = async (prefix: string): Promise<Player[]> => {
  const response = await send<{ searchResults: SearchResult[] }>(
    `${PLATFORM}/User/Search/GlobalName/0/`,
    { "Content-Type": "application/json" },
    { method: "POST", body: JSON.stringify({ displayNamePrefix: prefix }) },
  );

  return response.searchResults.flatMap((result) => {
    const membership = played(result.destinyMemberships);

    return membership === undefined
      ? []
      : [
          {
            name: result.bungieGlobalDisplayName,
            code: result.bungieGlobalDisplayNameCode,
            membership,
          },
        ];
  });
};

export const currentMemberships = (
  accessToken: string,
): Promise<UserMemberships> =>
  call<UserMemberships>("/User/GetMembershipsForCurrentUser/", accessToken);

const pickMembership = (memberships: UserMemberships): Membership => {
  const { destinyMemberships, primaryMembershipId } = memberships;

  const primary = primaryMembershipId
    ? destinyMemberships.find((m) => m.membershipId === primaryMembershipId)
    : undefined;

  const chosen = primary ?? destinyMemberships[0];

  if (!chosen) {
    throw new Error("Account has no Destiny memberships");
  }

  return chosen;
};

const MEMBERSHIP = "dvm.membership";

/** Membership from the last sign-in, without a network round trip */
export const storedMembership = (): Membership | undefined =>
  readStored(MEMBERSHIP) as Membership | undefined;

/** Stored membership, or the account's primary one fetched and stored */
export const cachedMembership = async (token: string): Promise<Membership> => {
  const cached = storedMembership();

  if (cached) {
    return cached;
  }

  const membership = pickMembership(await currentMemberships(token));
  writeStored(MEMBERSHIP, membership);

  return membership;
};

const profilePath = (membership: Membership): string =>
  `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}`;

export const fetchProfile = (
  membership: Membership,
  accessToken: string,
): Promise<DestinyProfileResponse> =>
  call<DestinyProfileResponse>(
    // Bungie will serve a cached snapshot with the same exact URL for up to a minute
    // Add a dummy date query arg to bust the cache
    `${profilePath(membership)}/?components=${COMPONENTS.join(",")}&_=${Date.now()}`,
    accessToken,
    PLATFORM,
    // Force the newest possible response
    "reload",
  );

// Not in the profile call - large and only Collections reads it
const COLLECTIBLES = 800;

export const fetchCollectibles = (
  membership: Membership,
  accessToken: string,
): Promise<DestinyProfileResponse> =>
  call<DestinyProfileResponse>(
    `${profilePath(membership)}/?components=${COLLECTIBLES}`,
    accessToken,
  );

const VENDOR_COMPONENTS = [400, 401, 402, 600];

export const fetchVendors = (
  membership: Membership,
  characterId: string,
  accessToken: string,
): Promise<DestinyVendorsResponse> =>
  call<DestinyVendorsResponse>(
    `${profilePath(membership)}/Character/${characterId}/Vendors/?components=${VENDOR_COMPONENTS.join(",")}&_=${Date.now()}`,
    accessToken,
    PLATFORM,
    "reload",
  );

// GetVendors always returns empty itemComponents
const VENDOR_ITEM_COMPONENTS = [300, 301, 304, 305, 308, 310, 402];

export const fetchVendor = (
  membership: Membership,
  characterId: string,
  vendorHash: number,
  accessToken: string,
): Promise<DestinyVendorResponse> =>
  call<DestinyVendorResponse>(
    `${profilePath(membership)}/Character/${characterId}/Vendors/${vendorHash}/?components=${VENDOR_ITEM_COMPONENTS.join(",")}`,
    accessToken,
    PLATFORM,
    "reload",
  );

const character = (membership: Membership, characterId: string): string =>
  `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Character/${characterId}`;

/** One page of completed runs for a character, most recent first */
export const fetchActivityHistory = async (
  membership: Membership,
  characterId: string,
  page: number,
  accessToken: string,
): Promise<DestinyHistoricalStatsPeriodGroup[]> => {
  const results = await call<DestinyActivityHistoryResults>(
    `${character(
      membership,
      characterId,
    )}/Stats/Activities/?count=${PAGE}&page=${page}`,
    accessToken,
    PLATFORM,
    // Page 0 grows as you play
    page === 0 ? "reload" : "default",
  );

  // Bungie omits the array entirely once the pages run out
  return results.activities ?? [];
};

export const fetchCarnageReport = (
  instanceId: string,
  accessToken: string,
): Promise<DestinyPostGameCarnageReportData> =>
  call<DestinyPostGameCarnageReportData>(
    `/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
    accessToken,
    STATS,
  );
