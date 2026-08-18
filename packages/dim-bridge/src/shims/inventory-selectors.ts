import type { DimItem } from "app/inventory/item-types";
import { getCurrentStore } from "app/inventory/stores-helpers";
import type { RootState } from "app/store/types";

// The real module reaches dim-api, manifest, settings and loadout-builder to build selectors
// the move layer never asks for. These three are the whole surface it uses
export const storesSelector = (state: RootState) => state.inventory.stores;

export const currentStoreSelector = (state: RootState) => getCurrentStore(storesSelector(state));

// Tags arrive with DIM Sync, which is not wired up yet. Untagged means nothing is protected
// from being moved aside, which is the permissive answer rather than a silently wrong one
export const getTagSelector = () => (_item: DimItem) => undefined;

// Reached only by the note-hashtag actions, which belong to DIM Sync as well
export const notesSelector = (_item: DimItem) => () => undefined;
