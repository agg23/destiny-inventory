import type { DestinyAccount } from "app/accounts/destiny-account";
import { createAction } from "typesafe-actions";

export const accountsLoaded = createAction("accounts/ACCOUNTS_LOADED")<DestinyAccount[]>();
export const setCurrentAccount = createAction("accounts/SET_CURRENT_ACCOUNT")<DestinyAccount>();
export const loadFromIDB = createAction("accounts/LOAD_FROM_IDB")<DestinyAccount[]>();
export const error = createAction("accounts/ERROR")<Error>();
export const loggedOut = createAction("accounts/LOG_OUT")();
export const needsDeveloper = createAction("accounts/DEV_INFO_NEEDED")();

// The real version inspects DIM's own token errors to decide whether to log the user out.
// Ours owns its tokens elsewhere, so a failed move stays a failed move
export const handleAuthErrors =
  (_e: unknown) =>
  async (): Promise<void> => {};
