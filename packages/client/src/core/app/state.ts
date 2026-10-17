import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createContext, useContext } from "solid-js";

import type { HistoryRun, timingsByHash } from "../activities/history.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import type { Matched } from "./matched.ts";

export interface AppState {
  loaded: () => LoadResult | undefined;
  stores: () => DimStore[];
  active: () => DimStore | undefined;
  playing: () => string | undefined;
  matched: () => Matched;
  shown: () => number;
  query: () => string;
  pinned: () => DimItem[];
  selected: () => DimItem[];
  isSelected: (item: DimItem) => boolean;
  awaitingPins: () => boolean;
  feed: () => DimItem[];
  moving: () => string | undefined;
  refreshing: () => boolean;
  runs: () => HistoryRun[];
  syncing: () => boolean;
  syncError: () => string | undefined;
  timings: () => ReturnType<typeof timingsByHash>;
  onPin: (item: DimItem) => void;
  onToggle: (item: DimItem) => void;
  onExtend: (item: DimItem, order: DimItem[]) => void;
  onSelectMany: (items: DimItem[]) => void;
  onUnpin: (item: DimItem) => void;
  onClearSelection: () => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onCollect: (items: DimItem[], target: DimStore) => void;
  onMoveMany: (items: DimItem[], target: DimStore) => void;
  /** Resolves with the items that moved */
  onMoveAll: (
    items: DimItem[],
    target: DimStore,
    verb: string,
    stop?: () => boolean,
  ) => Promise<DimItem[]>;
  refresh: () => Promise<void>;
  onCharacter: (store: DimStore) => void;
  onQuery: (query: string) => void;
}

export const AppContext = createContext<AppState>();

export const useApp = (): AppState => useContext(AppContext)!;
