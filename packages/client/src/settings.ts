import { createSignal } from "solid-js";

const KEY = "dvm.settings";

export const TILE_MIN = 32;
export const TILE_MAX = 96;

export interface Settings {
  tile: number;
  overlay: boolean;
}

export const DEFAULTS: Settings = {
  tile: 48,
  overlay: false,
};

const clamp = (next: Settings): Settings => ({
  tile: Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(next.tile))),
  overlay: next.overlay,
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

    const { tile, overlay } = parsed as Partial<Settings>;

    return clamp({
      tile: typeof tile === "number" ? tile : DEFAULTS.tile,
      overlay: typeof overlay === "boolean" ? overlay : DEFAULTS.overlay,
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
