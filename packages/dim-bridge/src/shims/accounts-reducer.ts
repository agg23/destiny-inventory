import type { DestinyAccount } from "app/accounts/destiny-account";
import type { Reducer } from "redux";
import { getType, type ActionType } from "typesafe-actions";

import * as actions from "./accounts-actions.ts";

// The real reducer seeds itself from DIM's auth tokens, its API key checks and localStorage.
// Ours is told which account is current and holds nothing else
export interface AccountsState {
  readonly accounts: readonly DestinyAccount[];
  readonly currentAccountMembershipId: string | undefined;
  readonly currentAccountDestinyVersion: 1 | 2 | undefined;
  readonly loaded: boolean;
  readonly loadedFromIDB: boolean;
  readonly accountsError?: Error;
  readonly needsLogin: boolean;
  readonly needsDeveloper: boolean;
}

export type AccountsAction = ActionType<typeof actions>;

const initialState: AccountsState = {
  accounts: [],
  currentAccountMembershipId: undefined,
  currentAccountDestinyVersion: 2,
  loaded: false,
  loadedFromIDB: false,
  needsLogin: false,
  needsDeveloper: false,
};

export const accounts: Reducer<AccountsState, AccountsAction> = (
  state = initialState,
  action,
): AccountsState => {
  switch (action.type) {
    case getType(actions.accountsLoaded):
      return { ...state, accounts: action.payload ?? [], loaded: true };

    case getType(actions.setCurrentAccount):
      return {
        ...state,
        currentAccountMembershipId: action.payload.membershipId,
        currentAccountDestinyVersion: action.payload.destinyVersion,
      };

    case getType(actions.loggedOut):
      return { ...initialState, needsLogin: true };

    default:
      return state;
  }
};
