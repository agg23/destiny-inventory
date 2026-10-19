import type { DimStore } from "app/inventory/store-types";

import type { HistoryRun } from "../../core/activities/history.ts";
import { acquired } from "../../core/items/arrivals.ts";
import { ORBIT } from "../../core/stats/attribute.ts";
import type { Change } from "../../core/stats/types.ts";
import { MINUTE } from "../../core/time.ts";

// TODO: Prototype only. ?stats=demo fills the page from the real profile, nothing is written
const held = globalThis as { dvmStatsDemo?: string | null };

held.dvmStatsDemo ??= new URLSearchParams(location.search).get("stats");

export const statsDemo = (): boolean => held.dvmStatsDemo === "demo";

const GLIMMER = 3159615086;
const BRIGHT_DUST = 2817410917;
const ENHANCEMENT_CORE = 3853748946;
const PVE_KILLS = 90275515;
const PVP_KILLS = 1501870536;
const STEP = 15_000;

/** Three activities over the last hour, with drops, a dismantle, a swap, kills, and currency */
export const demoChanges = (
  stores: DimStore[],
  runs: HistoryRun[],
  now: number,
): Change[] => {
  const character = stores.find((store) => !store.isVault);

  if (!character) {
    return [];
  }

  const characterId = character.id;
  const picked = [
    ...new Set(
      [...runs]
        .sort((a, b) => b.startedAt - a.startedAt)
        .map((run) => run.referenceId),
    ),
  ];
  const first = picked[0] ?? ORBIT;
  const second = picked[1] ?? first;
  const weapons = character.items.filter(
    (item) => item.equipped && item.bucket.inWeapons,
  );
  const drops = acquired(stores).slice(0, 5);
  const start = now - 60 * MINUTE;
  const changes: Change[] = [];

  const at = (offset: number) => ({
    from: start + offset - STEP,
    at: start + offset,
  });

  const enter = (activityHash: number, offset: number) =>
    changes.push({
      ...at(offset + STEP),
      kind: "activity",
      characterId,
      activityHash,
      modeHash: 0,
      playlistHash: 0,
      startedAt: start + offset,
    });

  const balance = (
    kind: "currency" | "stack",
    itemHash: number,
    offset: number,
    before: number,
    after: number,
  ) => changes.push({ ...at(offset), kind, itemHash, before, after });

  enter(first, 0);
  enter(ORBIT, 22 * MINUTE);
  enter(second, 26 * MINUTE);

  let glimmer = 180_000;
  let kills = 1_000;

  for (let offset = MINUTE; offset < 60 * MINUTE; offset += 2 * MINUTE) {
    const inOrbit = offset > 22 * MINUTE && offset < 26 * MINUTE;

    if (!inOrbit) {
      for (const [index, weapon] of weapons.entries()) {
        const gained = 3 + ((offset / MINUTE + index * 5) % 7);

        changes.push({
          ...at(offset),
          kind: "objective",
          instanceId: weapon.id,
          itemHash: weapon.hash,
          objectiveHash: index === 2 ? PVP_KILLS : PVE_KILLS,
          before: kills,
          after: kills + gained,
        });
      }

      kills += 20;
    }

    const earned = inOrbit ? -25_000 : 1_250;

    balance("currency", GLIMMER, offset, glimmer, glimmer + earned);
    glimmer += earned;
  }

  balance("currency", BRIGHT_DUST, 21 * MINUTE, 4_200, 4_350);
  balance("stack", ENHANCEMENT_CORE, 23 * MINUTE, 412, 402);
  balance("stack", ENHANCEMENT_CORE, 50 * MINUTE, 402, 404);

  const dropAt = [8, 21, 22.5, 40, 55];

  for (const [index, item] of drops.entries()) {
    changes.push({
      ...at((dropAt[index] ?? 55) * MINUTE),
      kind: "item",
      instanceId: item.id,
      itemHash: item.hash,
      characterId,
      bucketHash: item.bucket.hash,
      added: true,
    });
  }

  const kept = drops[0];

  if (kept) {
    changes.push({
      ...at(24 * MINUTE),
      kind: "item",
      instanceId: kept.id,
      itemHash: kept.hash,
      characterId,
      bucketHash: kept.bucket.hash,
      added: false,
    });
  }

  const swapped = weapons[0];

  if (swapped) {
    changes.push({
      ...at(30 * MINUTE),
      kind: "equip",
      characterId,
      bucketHash: swapped.bucket.hash,
      instanceId: swapped.id,
      itemHash: swapped.hash,
    });
  }

  return changes.sort((a, b) => a.at - b.at);
};
