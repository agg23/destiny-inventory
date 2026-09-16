import type {
  DestinyActivityHistoryResults,
  DestinyAggregateActivityResults,
  DestinyHistoricalStatsPeriodGroup,
  DestinyPostGameCarnageReportData,
  DestinyProfileResponse,
  DestinyVendorResponse,
  DestinyVendorsResponse,
} from "bungie-api-ts/destiny2";

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

interface Envelope<T> {
  Response: T;
  ErrorCode: number;
  ErrorStatus: string;
  Message: string;
}

const call = async <T>(
  path: string,
  accessToken: string,
  host = PLATFORM,
  cache: RequestCache = "default",
): Promise<T> => {
  const { apiKey } = await loadConfig();

  const response = await fetch(`${host}${path}`, {
    cache,
    headers: { "X-API-Key": apiKey, Authorization: `Bearer ${accessToken}` },
  });

  const body = (await response.json()) as Envelope<T>;

  if (body.ErrorCode !== 1) {
    throw new Error(`Bungie ${body.ErrorStatus}: ${body.Message}`);
  }

  return body.Response;
};

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const { apiKey } = await loadConfig();

  const response = await fetch(`${PLATFORM}${path}`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const envelope = (await response.json()) as Envelope<T>;

  if (envelope.ErrorCode !== 1) {
    throw new Error(`Bungie ${envelope.ErrorStatus}: ${envelope.Message}`);
  }

  return envelope.Response;
};

export interface UserMemberships {
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

// Cross save leaves one account holding the characters, and the others empty
const played = (memberships: CrossSaved[]): Membership | undefined =>
  memberships.find((one) => one.crossSaveOverride === one.membershipType) ??
  memberships[0];

/** Bungie name prefix search, which answers with at most 20 players */
export const searchPlayers = async (prefix: string): Promise<Player[]> => {
  const response = await post<{ searchResults: SearchResult[] }>(
    "/User/Search/GlobalName/0/",
    { displayNamePrefix: prefix },
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

export const pickMembership = (memberships: UserMemberships): Membership => {
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
export const storedMembership = (): Membership | undefined => {
  const held = localStorage.getItem(MEMBERSHIP);

  return held ? (JSON.parse(held) as Membership) : undefined;
};

/** Stored membership, or the account's primary one fetched and stored */
export const cachedMembership = async (token: string): Promise<Membership> => {
  const cached = storedMembership();

  if (cached) {
    return cached;
  }

  const membership = pickMembership(await currentMemberships(token));
  localStorage.setItem(MEMBERSHIP, JSON.stringify(membership));

  return membership;
};

export const fetchProfile = (
  membership: Membership,
  accessToken: string,
): Promise<DestinyProfileResponse> =>
  call<DestinyProfileResponse>(
    `/Destiny2/${membership.membershipType}/Profile/${
      membership.membershipId
    }/?components=${COMPONENTS.join(",")}`,
    accessToken,
    PLATFORM,
    // Force the newest possible response
    "reload",
  );

const VENDOR_COMPONENTS = [400, 401, 402, 600];

export const fetchVendors = (
  membership: Membership,
  characterId: string,
  accessToken: string,
): Promise<DestinyVendorsResponse> =>
  call<DestinyVendorsResponse>(
    `/Destiny2/${membership.membershipType}/Profile/${
      membership.membershipId
    }/Character/${characterId}/Vendors/?components=${VENDOR_COMPONENTS.join(
      ",",
    )}`,
    accessToken,
    PLATFORM,
    "reload",
  );

// GetVendors answers with an empty itemComponents however they are asked for, so a
// sale item's roll has to come from the single-vendor endpoint
const VENDOR_ITEM_COMPONENTS = [300, 301, 304, 305, 308, 310, 402];

export const fetchVendor = (
  membership: Membership,
  characterId: string,
  vendorHash: number,
  accessToken: string,
): Promise<DestinyVendorResponse> =>
  call<DestinyVendorResponse>(
    `/Destiny2/${membership.membershipType}/Profile/${
      membership.membershipId
    }/Character/${characterId}/Vendors/${vendorHash}/?components=${VENDOR_ITEM_COMPONENTS.join(
      ",",
    )}`,
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

export const fetchAggregateActivityStats = (
  membership: Membership,
  characterId: string,
  accessToken: string,
): Promise<DestinyAggregateActivityResults> =>
  call<DestinyAggregateActivityResults>(
    `${character(membership, characterId)}/Stats/AggregateActivityStats/`,
    accessToken,
  );

export const fetchCarnageReport = (
  instanceId: string,
  accessToken: string,
): Promise<DestinyPostGameCarnageReportData> =>
  call<DestinyPostGameCarnageReportData>(
    `/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
    accessToken,
    STATS,
  );
