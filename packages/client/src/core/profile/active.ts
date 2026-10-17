import type { DimStore } from "app/inventory/store-types";

export interface Active {
  playing: string | undefined;
  override: string | undefined;
  witnessed: string | undefined;
}

export const NOBODY: Active = {
  playing: undefined,
  override: undefined,
  witnessed: undefined,
};

export const observe = (
  active: Active,
  playing: string | undefined,
): Active => {
  if (active.override !== undefined && playing !== active.witnessed) {
    return { playing, override: undefined, witnessed: undefined };
  }

  return { ...active, playing };
};

export const prefer = (active: Active, storeId: string): Active => ({
  ...active,
  override: storeId,
  witnessed: active.playing,
});

export const activeStore = (
  active: Active,
  stores: DimStore[],
): DimStore | undefined => {
  const characters = stores.filter((store) => !store.isVault);
  const withId = (id: string | undefined) =>
    id === undefined ? undefined : characters.find((store) => store.id === id);

  return (
    withId(active.override) ??
    withId(active.playing) ??
    characters.find((store) => store.current) ??
    characters[0]
  );
};
