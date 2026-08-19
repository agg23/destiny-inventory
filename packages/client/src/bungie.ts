import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { loadConfig } from "./config.ts";

const PLATFORM = "https://www.bungie.net/Platform";

// 100 carries dateLastPlayed, which is how the store factory picks the current character
// 204 is CharacterActivities, which is how we tell who is in the game right now
// 1200 is StringVariables, without which every modifier reads "{var:2189146210}% bonus"
const COMPONENTS = [
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

const call = async <T>(path: string, accessToken: string): Promise<T> => {
  const { apiKey } = await loadConfig();

  const response = await fetch(`${PLATFORM}${path}`, {
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
