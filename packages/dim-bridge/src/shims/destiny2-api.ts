import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  equipItem,
  equipItems as equipItemsApi,
  getProfile,
  pullFromPostmaster,
  setItemLockState,
  setQuestTrackedState,
  transferItem,
  type DestinyProfileResponse,
  type PlatformErrorCodes,
  type ServerResponse,
} from "bungie-api-ts/destiny2";
import type { HttpClientConfig } from "bungie-api-ts/http";

interface Account {
  originalPlatformType: number;
  membershipId: string;
}

interface Credentials {
  apiKey: string;
  token: () => Promise<string>;
}

let credentials: Credentials | undefined = undefined;

// The real module reads DIM's account state and its own auth stack. Ours is handed the pieces
// so the bridge never has to know how the client stores a token
export const configureBungieApi = (next: Credentials): void => {
  credentials = next;
};

const client = async (config: HttpClientConfig): Promise<unknown> => {
  if (!credentials) {
    throw new Error("Bungie API used before configureBungieApi");
  }

  const url = new URL(config.url);

  for (const [key, value] of Object.entries(config.params ?? {})) {
    url.searchParams.append(key, String(value));
  }

  const response = await fetch(url, {
    method: config.method,
    body: config.body === undefined ? undefined : JSON.stringify(config.body),
    headers: {
      "X-API-Key": credentials.apiKey,
      Authorization: `Bearer ${await credentials.token()}`,
      ...(config.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
  });

  const body = (await response.json()) as ServerResponse<unknown>;

  if (body.ErrorCode !== 1) {
    throw new Error(`Bungie ${body.ErrorStatus}: ${body.Message}`);
  }

  return body;
};

const http = client as never;

export const transfer = (
  account: Account,
  item: DimItem,
  store: DimStore,
  amount: number,
): Promise<ServerResponse<number>> => {
  const request = {
    characterId: store.isVault || item.location.inPostmaster ? item.owner : store.id,
    membershipType: account.originalPlatformType,
    itemId: item.id,
    itemReferenceHash: item.hash,
    stackSize: amount || item.amount,
    transferToVault: store.isVault,
  };

  return item.location.inPostmaster
    ? pullFromPostmaster(http, request)
    : transferItem(http, request);
};

export const equip = (account: Account, item: DimItem): Promise<ServerResponse<number>> => {
  if (item.owner === "vault") {
    throw new Error("Cannot equip to vault");
  }

  return equipItem(http, {
    characterId: item.owner,
    membershipType: account.originalPlatformType,
    itemId: item.id,
  });
};

// Exotics sort last, matching DIM: equipping them first can reject the rest of the batch
export const equipItems = async (
  account: Account,
  store: DimStore,
  items: DimItem[],
): Promise<{ [itemInstanceId: string]: PlatformErrorCodes }> => {
  const itemIds = items.toSorted((a, b) => Number(a.isExotic) - Number(b.isExotic)).map((i) => i.id);

  const response = await equipItemsApi(http, {
    characterId: store.id,
    membershipType: account.originalPlatformType,
    itemIds,
  });

  return Object.fromEntries(
    response.Response.equipResults.map((result) => [result.itemInstanceId, result.equipStatus]),
  );
};

export const setLockState = (
  account: Account,
  storeId: string,
  item: DimItem,
  lockState: boolean,
): Promise<ServerResponse<number>> =>
  setItemLockState(http, {
    characterId: storeId,
    membershipType: account.originalPlatformType,
    itemId: item.id,
    state: lockState,
  });

export const setTrackedState = (
  account: Account,
  storeId: string,
  item: DimItem,
  trackedState: boolean,
): Promise<ServerResponse<number>> => {
  if (!item.trackable) {
    throw new Error("Can't track non-trackable items");
  }

  return setQuestTrackedState(http, {
    characterId: storeId,
    membershipType: account.originalPlatformType,
    itemId: item.id,
    state: trackedState,
  });
};

export const getCharacters = (account: Account): Promise<DestinyProfileResponse> =>
  getProfile(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.originalPlatformType,
    components: [200],
  }).then((response) => response.Response);
