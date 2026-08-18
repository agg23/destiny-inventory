import type { AccountsState } from "app/accounts/reducer";
import type { InventoryState } from "app/inventory/reducer";
import type { ThunkAction, ThunkDispatch } from "redux-thunk";
import type { UnknownAction } from "redux";

// DIM's root state has thirteen slices. The move layer reads two, so the rest would be dead
// weight that drags in dim-api, manifest, wishlists and settings behind it
export interface RootState {
  accounts: AccountsState;
  inventory: InventoryState;
}

export type ThunkResult<R = void> = ThunkAction<Promise<R>, RootState, undefined, UnknownAction>;

export type DimThunkDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;

export type ThunkDispatchProp = {
  dispatch: DimThunkDispatch;
};
