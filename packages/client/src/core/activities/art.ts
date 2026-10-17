import type { SlimActivity } from "@dvm/defs-core";

import { BUNGIE } from "../api/bungie.ts";
import { identity, VARIANT } from "./activityNames.ts";
import type { ActivityTables } from "./types.ts";

interface ArtIndex {
  exact: Map<string, SlimActivity[]>;
  named: Map<string, SlimActivity[]>;
}

const ART_INDEX = new WeakMap<ActivityTables, ArtIndex>();

const push = (
  into: Map<string, SlimActivity[]>,
  key: string,
  one: SlimActivity,
) => {
  const found = into.get(key);

  if (found) {
    found.push(one);
  } else {
    into.set(key, [one]);
  }
};

const artIndex = (tables: ActivityTables): ArtIndex => {
  const held = ART_INDEX.get(tables);

  if (held) {
    return held;
  }

  const built: ArtIndex = { exact: new Map(), named: new Map() };

  for (const definition of Object.values(tables.activities)) {
    if (!definition.pgcrImage) {
      continue;
    }

    push(built.exact, identity(definition), definition);
    push(built.named, definition.name.replace(VARIANT, ""), definition);
  }

  ART_INDEX.set(tables, built);

  return built;
};

// "Master Conquest: Derealize" is the same mission as "Derealize", one prefix deeper
const tail = (name: string): string => {
  const parts = name.split(": ");

  return parts[parts.length - 1]!;
};

/** Resolves art for one activity, reaching for twins Bungie gave art the profile never lists */
export const activityArt = (
  definition: SlimActivity,
  tables: ActivityTables,
  group: SlimActivity[] = [],
): string | undefined => {
  const index = artIndex(tables);
  const bare = definition.name.replace(VARIANT, "");
  const where = definition.destinationHash ?? definition.placeHash ?? 0;
  const arted = [
    definition,
    ...group,
    ...(index.exact.get(identity(definition)) ?? []),
    ...(index.named.get(bare) ?? []),
    ...(index.exact.get(`${tail(bare)}|${where}`) ?? []),
    ...(index.named.get(tail(bare)) ?? []),
  ].filter((one) => one.pgcrImage);

  return (
    arted.find((one) => one.modeType === definition.modeType)?.pgcrImage ??
    arted[0]?.pgcrImage
  );
};

export const backdrop = (
  group: { definition: SlimActivity }[],
  tables: ActivityTables,
): string | undefined =>
  activityArt(
    group[0]!.definition,
    tables,
    group.map(({ definition }) => definition),
  );

// 55 Portal activities carry no art anywhere in the manifest, so the tile falls back to a wash
const WASH: Record<string, string> = {
  "The Crucible": "#7a2320, #31161a",
  "Trials of Osiris": "#8a6a1f, #2b2418",
  "Lighthouse Simulation": "#8a6a1f, #2b2418",
  Nightfall: "#8a5410, #2c2015",
  "Vanguard Op": "#1f4f77, #16212c",
  Raid: "#6d4f12, #28211a",
  Gambit: "#3f6b1c, #1b2716",
  "Seasonal Arena": "#1d5f5c, #16262a",
  "Exotic Mission": "#5a4a7a, #221f2c",
  Mission: "#33475c, #1a2029",
  Story: "#33475c, #1a2029",
  "Solo Ops": "#2c5566, #182227",
  Crawl: "#573a5e, #241a29",
  Explore: "#3f5a35, #1d2419",
  Social: "#6b563a, #262019",
  "Sparrow Racing League": "#7a3a5a, #2a1a24",
};

const NEUTRAL_WASH = "#3a3d42, #1e2024";

/** A background-image value for an activity tile, either its art or a wash keyed to its type */
export const tileArt = (
  image: string | undefined,
  typeName: string | undefined,
): string =>
  image
    ? `url(${BUNGIE}${image})`
    : `linear-gradient(150deg, ${WASH[typeName ?? ""] ?? NEUTRAL_WASH})`;
