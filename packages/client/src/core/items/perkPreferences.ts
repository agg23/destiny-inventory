import { createSignal } from "solid-js";

import type { PerkPreference, Stance } from "@dvm/service";

import { callService } from "../api/auth.ts";
import { readStored, writeStored } from "../storage.ts";
import { MODES, type Mode } from "./rollTypes.ts";
import { mergeNewer } from "./sync.ts";

const KEY = "dvm.perkPreferences";

const ENDPOINT = "/api/perk-preferences";

export type Stances = Record<Mode, ReadonlyMap<string, Stance>>;

interface Held {
  preferences: PerkPreference[];
  since: number;
}

const EMPTY: Held = { preferences: [], since: 0 };

const preferenceKey = (preference: { mode: Mode; perk: string }): string =>
  `${preference.mode}/${preference.perk}`;

const restore = (): Held => {
  const parsed = readStored(KEY) as Partial<Held> | undefined;

  if (!parsed) {
    return EMPTY;
  }

  return {
    preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
    since: typeof parsed.since === "number" ? parsed.since : 0,
  };
};

let held: Held = restore();

const [stances, setStances] = createSignal<Stances>({
  pve: new Map(),
  pvp: new Map(),
});

const publish = () => {
  const next: Record<Mode, Map<string, Stance>> = {
    pve: new Map(),
    pvp: new Map(),
  };

  for (const preference of held.preferences) {
    if (!preference.removed) {
      next[preference.mode].set(preference.perk, preference.stance);
    }
  }

  setStances(next);
};

const save = () => {
  try {
    writeStored(KEY, held);
  } catch {
    // Quota or private mode, server still has it
  }
};

const merge = (incoming: PerkPreference[]): PerkPreference[] =>
  mergeNewer(held.preferences, incoming, preferenceKey);

/** The name a stance is stored under */
export const basePerkName = (name: string): string =>
  // Bungie names a few enhanced traits "X Enhanced"
  name.replace(/ Enhanced$/, "");

/** Saved stances by perk name, for both modes */
export const perkStances = stances;

/** Pulls everything newer than the last sync, removals included */
export const syncPerkPreferences = async (): Promise<void> => {
  const response = await callService(`${ENDPOINT}?since=${held.since}`);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json()) as {
    preferences: PerkPreference[];
    now: number;
  };

  held = { preferences: merge(body.preferences), since: body.now };

  save();
  publish();
};

/** Writes whatever differs from the saved stances. False when the service did not take it */
export const savePerkStances = async (next: Stances): Promise<boolean> => {
  const current = stances();
  const changes = MODES.flatMap((mode) => {
    const perks = new Set([...current[mode].keys(), ...next[mode].keys()]);

    return [...perks].flatMap((perk) => {
      const before = current[mode].get(perk);
      const after = next[mode].get(perk);

      if (before === after) {
        return [];
      }

      return [
        {
          mode,
          perk,
          // They differ, so one is set
          stance: (after ?? before)!,
          removed: after === undefined,
        },
      ];
    });
  });

  if (changes.length === 0) {
    return true;
  }

  const response = await callService(ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ preferences: changes }),
  });

  if (!response?.ok) {
    return false;
  }

  const { now } = (await response.json()) as { now: number };

  held = {
    ...held,
    preferences: merge(
      changes.map((change) => ({ ...change, updatedAt: now })),
    ),
  };

  save();
  publish();

  return true;
};

publish();
