import type { AccountsState } from "app/accounts/reducer";
import type { InventoryState } from "app/inventory/reducer";
import type { ThunkAction, ThunkDispatch } from "redux-thunk";
import type { UnknownAction } from "redux";

// Move layer reads 2 of DIM's 13 slices. The rest drag in dim-api, manifest, wishlists and settings
export interface RootState {
  accounts: AccountsState;
  inventory: InventoryState;
}

export type ThunkResult<R = void> = ThunkAction<Promise<R>, RootState, undefined, UnknownAction>;

export type DimThunkDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;

export type ThunkDispatchProp = {
  dispatch: DimThunkDispatch;
};
