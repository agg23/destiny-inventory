// Rows are never deleted. A removal is the flag plus a fresh timestamp

const MAX_CHANGES = 1_000;

export const PERK_MODES = ["pve", "pvp"] as const;

export type PerkMode = (typeof PERK_MODES)[number];

export const STANCES = ["up", "down"] as const;

export type Stance = (typeof STANCES)[number];

export interface PerkPreference {
  mode: PerkMode;
  /** Display name, shared by enhanced versions */
  perk: string;
  stance: Stance;
  removed: boolean;
  updatedAt: number;
}

export type PerkPreferenceChange = Omit<PerkPreference, "updatedAt">;

export interface PerkPreferenceStore {
  read: (membershipId: string, since: number) => Promise<PerkPreference[]>;
  write: (
    membershipId: string,
    changes: PerkPreferenceChange[],
    now: number,
  ) => Promise<void>;
}

const readChange = (raw: unknown): PerkPreferenceChange | undefined => {
  const { mode, perk, stance, removed } = (raw ?? {}) as Record<
    string,
    unknown
  >;

  const cleanMode = PERK_MODES.find((one) => one === mode);
  const cleanStance = STANCES.find((one) => one === stance);

  if (
    cleanMode === undefined ||
    cleanStance === undefined ||
    typeof perk !== "string" ||
    perk.length === 0 ||
    perk.length > 200
  ) {
    return undefined;
  }

  return {
    mode: cleanMode,
    perk,
    stance: cleanStance,
    removed: !!removed,
  };
};

/** Undefined when the body is not a well formed batch of changes */
export const parsePreferences = (
  body: unknown,
): PerkPreferenceChange[] | undefined => {
  const { preferences } = (body ?? {}) as Record<string, unknown>;

  if (
    !Array.isArray(preferences) ||
    preferences.length === 0 ||
    preferences.length > MAX_CHANGES
  ) {
    return undefined;
  }

  const clean = preferences.flatMap((raw) => {
    const change = readChange(raw);

    return change ? [change] : [];
  });

  // Partial writes would silently drop changes
  if (clean.length !== preferences.length) {
    return undefined;
  }

  return clean;
};
