import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import type { SlimItemSource } from "@dvm/defs-core";

import { fetchRecords } from "../api/artifacts.ts";
import { cached } from "../api/cache.ts";
import { loadConfig } from "../api/config.ts";
import { SOURCE_SECTIONS } from "../collections/terms.ts";

// Collections groups are plural headings
const ITEM_LABELS: Record<string, string> = {
  legendaryengram: "World drop",
  campaign: "Campaign",
  seasonpass: "Season pass",
  events: "Event",
  exoticquest: "Exotic quest",
  exoticengram: "Exotic engram",
  exoticarchive: "Exotic Archive",
  xur: "Xûr",
  monumentoftriumph: "Monument",
  rahool: "Rahool",
  raid: "Raid",
  dungeon: "Dungeon",
  renegades: "Renegades",
  edgeoffate: "The Edge of Fate",
  heresy: "Episode Heresy",
  revenant: "Episode Revenant",
  echoes: "Episode Echoes",
  "30th": "30th Anniversary",
  "ritual-weapon": "Ritual weapon",
  "pinnacle-weapon": "Pinnacle weapon",
  blackarmory: "Black Armory",
  riteofthenine: "Rite of the Nine",
  brave: "Into the Light",
  intothelight: "Into the Light",
  calus: "Calus",
  pantheon: "Pantheon",
  adventure: "Adventure",
  sparrowracingleague: "Sparrow Racing League",
  sundial: "The Sundial",
  wellspring: "The Wellspring",
  menagerie: "The Menagerie",
  vexoffensive: "Vex Offensive",
  haunted: "Season of the Haunted",
  plunder: "Season of Plunder",
  sonar: "Season of the Deep",
  lost: "Season of the Lost",
  rasputin: "Season of the Seraph",
  evidenceboard: "Evidence Board",
  deluxe: "Deluxe edition",
  psiops: "PsiOps Battlegrounds",
  battlegrounds: "Battlegrounds",
  fwc: "Future War Cult",
  do: "Dead Orbit",
  nm: "New Monarchy",
  ikora: "Ikora",
  ada: "Ada-1",
  banshee: "Banshee-44",
  saint14: "Saint-14",
  lostsectors: "Lost Sectors",
  mercury: "Mercury",
  io: "Io",
  mars: "Mars",
  titan: "Titan",
  cosmodrome: "Cosmodrome",
  contact: "Contact",
  presage: "Presage",
  wrathborn: "Wrathborn Hunts",
  rivenslair: "Riven's Lair",
};

// Matches Bungie's wording, "Prophecy" Dungeon
const KINDS: Record<string, string> = {
  Raids: "Raid",
  Dungeons: "Dungeon",
};

const LABELS = new Map<string, string>([
  ...SOURCE_SECTIONS.flatMap((section) =>
    section.keys.map(([key, label]): [string, string] => {
      const kind = KINDS[section.label];

      return [key, kind === undefined ? label : `"${label}" ${kind}`];
    }),
  ),
  ...Object.entries(ITEM_LABELS),
]);

const [table, setTable] = createSignal<Map<number, string[]> | undefined>(
  undefined,
);

const itemSources = cached(async () => {
  const { artifacts } = await loadConfig();
  const rows = await fetchRecords<SlimItemSource>(artifacts, "ItemSource");

  setTable(new Map(rows.map((row) => [row.hash, row.keys])));
});

/** Short name of where an item drops, from DIM's source tags. Narrowest tag wins */
export const sourceName = (item: DimItem): string | undefined => {
  const loaded = table();

  if (!loaded) {
    void itemSources().catch(() => setTable(new Map()));

    return undefined;
  }

  const key = (loaded.get(item.hash) ?? []).find((one) => LABELS.has(one));

  return key === undefined ? undefined : LABELS.get(key);
};
