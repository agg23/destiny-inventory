import { accounts } from "app/accounts/reducer";
import { inventory } from "app/inventory/reducer";
import type { RootState } from "app/store/types";
import { applyMiddleware, combineReducers, legacy_createStore as createStore, type Reducer } from "redux";
import { thunk } from "redux-thunk";

// The slice reducers carry their own narrow action unions, which combineReducers widens into
// something createStore cannot infer against
const root = combineReducers({ accounts, inventory }) as unknown as Reducer<RootState>;

// DIM's store singleton wires in devtools and hot reload, and its root reducer reaches most
// of the app. This is the same store shape the move layer actually reads
export const store = createStore(root, applyMiddleware(thunk));

export default store;
