import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

const PLATFORM = "https://www.bungie.net/Platform";

// 102 and 201 need OAuth, the rest come back for any profile its owner hasn't hidden
const COMPONENTS = [102, 103, 200, 201, 205, 300, 302, 304, 305, 306, 307, 308, 309, 310];

const ALL_PLATFORMS = -1;

export interface Membership {
  membershipType: number;
  membershipId: string;
}

interface BungieEnvelope<T> {
  Response: T;
  ErrorCode: number;
  ErrorStatus: string;
  Message: string;
}

const call = async <T>(path: string, apiKey: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${PLATFORM}${path}`, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json()) as BungieEnvelope<T>;

  if (body.ErrorCode !== 1) {
    throw new Error(`Bungie ${body.ErrorStatus} on ${path}: ${body.Message}`);
  }

  return body.Response;
};

interface GlobalSearchResult {
  bungieGlobalDisplayName: string;
  bungieGlobalDisplayNameCode?: number;
  destinyMemberships: Membership[];
}

const searchByPrefix = async (prefix: string, apiKey: string): Promise<Membership> => {
  const response = await call<{ searchResults: GlobalSearchResult[] }>(
    "/User/Search/GlobalName/0/",
    apiKey,
    { method: "POST", body: JSON.stringify({ displayNamePrefix: prefix }) },
  );

  const exact = response.searchResults.filter(
    (result) =>
      result.bungieGlobalDisplayName.toLowerCase() === prefix.toLowerCase() &&
      result.destinyMemberships.length > 0,
  );

  if (exact.length === 0) {
    throw new Error(`No Destiny profile matching ${prefix}`);
  }

  if (exact.length > 1) {
    const names = exact
      .map((result) => `${result.bungieGlobalDisplayName}#${result.bungieGlobalDisplayNameCode}`)
      .join(", ");

    throw new Error(`${prefix} is ambiguous. Set BUNGIE_NAME to one of: ${names}`);
  }

  const [match] = exact;
  const [membership] = match!.destinyMemberships;

  if (!membership) {
    throw new Error(`${prefix} has no Destiny memberships`);
  }

  console.log(
    `Resolved ${prefix} to ${match!.bungieGlobalDisplayName}#${match!.bungieGlobalDisplayNameCode}`,
  );

  return membership;
};

export const resolveBungieName = async (
  bungieName: string,
  apiKey: string,
): Promise<Membership> => {
  const [displayName, code] = bungieName.split("#");

  if (!displayName) {
    throw new Error(`Expected a Bungie name, got ${bungieName}`);
  }

  if (!code) {
    return searchByPrefix(displayName, apiKey);
  }

  const results = await call<Membership[]>(
    `/Destiny2/SearchDestinyPlayerByBungieName/${ALL_PLATFORMS}/`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({ displayName, displayNameCode: Number(code) }),
    },
  );

  const [first] = results;

  if (!first) {
    throw new Error(`No Destiny profile for ${bungieName}`);
  }

  return first;
};

// Bungie.net membership id, not a Destiny one
export const currentMemberships = async (
  apiKey: string,
  accessToken: string,
): Promise<Membership[]> => {
  const response = await call<{ destinyMemberships: Membership[] }>(
    "/User/GetMembershipsForCurrentUser/",
    apiKey,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  return response.destinyMemberships;
};

export const fetchProfile = async (
  membership: Membership,
  apiKey: string,
  accessToken?: string,
): Promise<DestinyProfileResponse> => {
  const components = COMPONENTS.join(",");
  const path = `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}`;

  return call<DestinyProfileResponse>(path, apiKey, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
};
