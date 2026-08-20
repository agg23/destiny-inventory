// Bungie ships no live distortion state (BUNGIE-API.md §6)
export interface Zone {
  name: string;
  short?: string;
  // The reprised armor the zone drops, a DestinyEquipableItemSetDefinition hash
  set: number;
}

export const ZONES: Zone[] = [
  { name: "Cosmodrome", set: 222121557 },
  { name: "European Dead Zone", short: "EDZ", set: 2554324129 },
  { name: "Dreaming City", set: 428813981 },
  { name: "Savathûn's Throne World", short: "Throne World", set: 2481896422 },
  { name: "Moon", set: 2250480800 },
  { name: "Europa", set: 3090557911 },
  { name: "Nessus", set: 3120219904 },
];

export const HOUR = 3_600_000;

// Europa held this hour by in-game observation
const ANCHOR = Date.UTC(2026, 6, 26, 13);
const ANCHOR_ZONE = 5;

const NOWHERE: Zone = { name: "", set: 0 };

export interface Rotation extends Zone {
  start: number;
}

export const schedule = (now: number): Rotation[] => {
  const hours = Math.floor((now - ANCHOR) / HOUR);

  return ZONES.map((_, ahead) => {
    const spins = ANCHOR_ZONE + hours + ahead;
    const at = ((spins % ZONES.length) + ZONES.length) % ZONES.length;

    return {
      ...(ZONES[at] ?? NOWHERE),
      start: ANCHOR + (hours + ahead) * HOUR,
    };
  });
};

export const clock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const seconds = total % 60;

  return `${Math.floor(total / 60)}:${seconds < 10 ? "0" : ""}${seconds}`;
};
