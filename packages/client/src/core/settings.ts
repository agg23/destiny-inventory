import { createSignal } from "solid-js";

import type { Mode } from "./items/rollTypes.ts";
import { readStored, writeStored } from "./storage.ts";

const KEY = "dvm.settings";

export const TILE_MIN = 48;
export const TILE_MAX = 96;

export const RATING_DISPLAYS = [
  "pve-pvp",
  "pvp-pve",
  "pve",
  "pvp",
  "none",
] as const;

type RatingDisplay = (typeof RATING_DISPLAYS)[number];

export const RATING_DISPLAY_NAMES: Record<RatingDisplay, string> = {
  "pve-pvp": "PvE, PvP",
  "pvp-pve": "PvP, PvE",
  pve: "PvE only",
  pvp: "PvP only",
  none: "None",
};

const RATING_DISPLAY_MODES: Record<RatingDisplay, Mode[]> = {
  "pve-pvp": ["pve", "pvp"],
  "pvp-pve": ["pvp", "pve"],
  pve: ["pve"],
  pvp: ["pvp"],
  none: [],
};

export const VAULT_SORTS = ["name", "power"] as const;

export type VaultSort = (typeof VAULT_SORTS)[number];

export const VAULT_SORT_NAMES: Record<VaultSort, string> = {
  name: "Name",
  power: "Power",
};

export interface Settings {
  tile: number;
  overlay: boolean;
  ratings: RatingDisplay;
  sort: VaultSort;
  hideOtherClasses: boolean;
}

export const DEFAULTS: Settings = {
  tile: 60,
  overlay: false,
  ratings: "pve-pvp",
  sort: "name",
  hideOtherClasses: false,
};

const clamp = (next: Settings): Settings => ({
  tile: Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(next.tile))),
  overlay: next.overlay,
  ratings: next.ratings,
  sort: next.sort,
  hideOtherClasses: next.hideOtherClasses,
});

const read = (): Settings => {
  const parsed = readStored(KEY);

  if (typeof parsed !== "object" || parsed === null) {
    return DEFAULTS;
  }

  const { tile, overlay, ratings, sort, hideOtherClasses } =
    parsed as Partial<Settings>;

  return clamp({
    tile: typeof tile === "number" ? tile : DEFAULTS.tile,
    overlay: typeof overlay === "boolean" ? overlay : DEFAULTS.overlay,
    ratings: RATING_DISPLAYS.some((display) => display === ratings)
      ? ratings!
      : DEFAULTS.ratings,
    sort: VAULT_SORTS.some((one) => one === sort) ? sort! : DEFAULTS.sort,
    hideOtherClasses:
      typeof hideOtherClasses === "boolean"
        ? hideOtherClasses
        : DEFAULTS.hideOtherClasses,
  });
};

const [saved, setSaved] = createSignal<Settings>(read());
const [draft, setDraft] = createSignal<Settings | undefined>(undefined);

/** Saved settings, or the unsaved draft while the settings popover is open */
export const settings = (): Settings => draft() ?? saved();

export const savedSettings = saved;

export const previewSettings = (next: Settings | undefined) =>
  setDraft(next === undefined ? undefined : clamp(next));

export const applySettings = (next: Settings) => {
  const clean = clamp(next);

  setSaved(clean);
  setDraft(undefined);
  writeStored(KEY, clean);
};

/** Shown rating modes, main first; tiles show the second only at B or better */
export const shownModes = (): Mode[] =>
  RATING_DISPLAY_MODES[settings().ratings];
