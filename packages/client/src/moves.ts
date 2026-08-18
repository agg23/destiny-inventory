import { accountsLoaded, setCurrentAccount } from "app/accounts/actions";
import type { DestinyAccount } from "app/accounts/destiny-account";
import { update } from "app/inventory/actions";
import { createMoveSession, executeMoveItem } from "app/inventory/item-move-service";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import store from "app/store/store";
import type { DimThunkDispatch } from "app/store/types";
import { neverCanceled } from "app/utils/cancel";

import { configureBungieApi } from "@dvm/dim-bridge";

import { accessToken } from "./auth.ts";
import type { Membership } from "./bungie.ts";
import { loadConfig } from "./config.ts";

const dispatch = store.dispatch as DimThunkDispatch;

const toAccount = (membership: Membership): DestinyAccount => ({
  displayName: "",
  originalPlatformType: membership.membershipType,
  platformLabel: "",
  membershipId: membership.membershipId,
  destinyVersion: 2,
  platforms: [membership.membershipType],
  lastPlayed: new Date(0),
});

// The move engine reads its world through Redux, so the stores it reasons about have to be
// the ones on screen. Seeding happens once per load; the reducer keeps them current after
export const seedInventory = async (stores: DimStore[], membership: Membership): Promise<void> => {
  const { apiKey } = await loadConfig();

  configureBungieApi({
    apiKey,
    token: async () => {
      const token = await accessToken();

      if (!token) {
        throw new Error("Not signed in");
      }

      return token;
    },
  });

  const account = toAccount(membership);

  // setCurrentAccount resets the inventory slice, so it has to come before the stores
  dispatch(accountsLoaded([account]));
  dispatch(setCurrentAccount(account));
  dispatch(update({ stores, currencies: [] }));
};

export const currentStores = (): DimStore[] => store.getState().inventory.stores;

// A move dispatches more than once, and not all of it lands before the promise resolves.
// Reading the state on a subscription rather than sampling it is what keeps the grid honest
export const subscribeStores = (listener: (stores: DimStore[]) => void): (() => void) =>
  store.subscribe(() => listener(currentStores()));

// Smart move: the engine makes space, de-equips, and cascades move-asides as needed
export const moveItem = async (
  item: DimItem,
  target: DimStore,
  equip: boolean,
): Promise<DimItem> => {
  const session = createMoveSession(neverCanceled, [item]);

  return dispatch(executeMoveItem(item, target, { equip, amount: item.amount }, session));
};
