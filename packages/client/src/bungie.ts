import type {
  DestinyActivityHistoryResults,
  DestinyAggregateActivityResults,
  DestinyHistoricalStatsPeriodGroup,
  DestinyPostGameCarnageReportData,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { loadConfig } from "./config.ts";

const PLATFORM = "https://www.bungie.net/Platform";

// www.bungie.net answers a PGCR request with a bare 301 and no body
const STATS = "https://stats.bungie.net/Platform";

const PAGE = 250;

const COMPONENTS = [
  // 100 dateLastPlayed, 204 CharacterActivities, 1200 StringVariables
  100, 102, 103, 200, 201, 204, 205, 300, 302, 304, 305, 306, 307, 308, 309,
  310, 1200,
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
): Promise<T> => {
  const { apiKey } = await loadConfig();

  const response = await fetch(`${host}${path}`, {
    headers: { "X-API-Key": apiKey, Authorization: `Bearer ${accessToken}` },
  });

  const body = (await response.json()) as Envelope<T>;

  if (body.ErrorCode !== 1) {
    throw new Error(`Bungie ${body.ErrorStatus}: ${body.Message}`);
  }

  return body.Response;
};

export interface UserMemberships {
  destinyMemberships: Membership[];
  primaryMembershipId?: string;
}

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

export const fetchProfile = (
  membership: Membership,
  accessToken: string,
): Promise<DestinyProfileResponse> =>
  call<DestinyProfileResponse>(
    `/Destiny2/${membership.membershipType}/Profile/${
      membership.membershipId
    }/?components=${COMPONENTS.join(",")}`,
    accessToken,
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
