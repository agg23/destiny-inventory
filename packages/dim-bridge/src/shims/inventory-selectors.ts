import type { DimItem } from "app/inventory/item-types";
import { getCurrentStore } from "app/inventory/stores-helpers";
import type { RootState } from "app/store/types";

// Real module pulls in dim-api, manifest, settings and loadout-builder. Move layer only uses these
export const storesSelector = (state: RootState) => state.inventory.stores;

export const currentStoreSelector = (state: RootState) => getCurrentStore(storesSelector(state));

// No tags here. Nothing is protected from being moved aside
export const getTagSelector = () => (_item: DimItem) => undefined;

// Only the note-hashtag actions reach this
export const notesSelector = (_item: DimItem) => () => undefined;
