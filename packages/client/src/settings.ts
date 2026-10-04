import { createSignal } from "solid-js";

import type { Mode } from "./rolls.ts";

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

export type RatingDisplay = (typeof RATING_DISPLAYS)[number];

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

export interface Settings {
  tile: number;
  overlay: boolean;
  ratings: RatingDisplay;
}

export const DEFAULTS: Settings = {
  tile: 60,
  overlay: false,
  ratings: "pve-pvp",
};

const clamp = (next: Settings): Settings => ({
  tile: Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(next.tile))),
  overlay: next.overlay,
  ratings: next.ratings,
});

const read = (): Settings => {
  const raw = localStorage.getItem(KEY);

  if (raw === null) {
    return DEFAULTS;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULTS;
    }

    const { tile, overlay, ratings } = parsed as Partial<Settings>;

    return clamp({
      tile: typeof tile === "number" ? tile : DEFAULTS.tile,
      overlay: typeof overlay === "boolean" ? overlay : DEFAULTS.overlay,
      ratings: RATING_DISPLAYS.some((display) => display === ratings)
        ? ratings!
        : DEFAULTS.ratings,
    });
  } catch {
    return DEFAULTS;
  }
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
  localStorage.setItem(KEY, JSON.stringify(clean));
};

/** The modes shown on tiles, cards, and verdicts, main mode first. The second only shows on a tile at B or better */
export const shownModes = (): Mode[] =>
  RATING_DISPLAY_MODES[settings().ratings];
