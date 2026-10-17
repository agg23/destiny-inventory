import { accounts } from "app/accounts/reducer";
import { inventory } from "app/inventory/reducer";
import type { RootState } from "app/store/types";
import { applyMiddleware, combineReducers, legacy_createStore as createStore, type Reducer } from "redux";
import { thunk } from "redux-thunk";

// combineReducers widens the slice action unions past what createStore can infer
const root = combineReducers({ accounts, inventory }) as unknown as Reducer<RootState>;

// DIM's singleton wires in devtools and hot reload and reaches most of the app
export const store = createStore(root, applyMiddleware(thunk));

export default store;
