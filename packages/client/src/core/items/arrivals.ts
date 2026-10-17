import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { minBy } from "es-toolkit";

import { assess, versionsOf } from "./rolls.ts";
import { MODE_NAMES, type Assessment, type Mode } from "./rollTypes.ts";

const PADDING = 20;
const SHOWN = 10;

/** Acquisition order sort key; instance ids ascend but vary in digit count */
export const recency = (item: DimItem): string => item.id.padStart(PADDING, "0");

/** Sort comparator, most recently acquired first */
export const newestFirst = (a: DimItem, b: DimItem): number =>
  recency(a) < recency(b) ? 1 : -1;

// Stacks all share the id "0"
const dropped = (item: DimItem) => item.id !== "0" && item.equipment;

export const acquired = (stores: DimStore[]): DimItem[] =>
  stores
    .flatMap((store) => store.items)
    .filter(dropped)
    .sort(newestFirst)
    .slice(0, SHOWN);

type VerdictKind = "only" | "better" | "equal" | "worse" | "mixed";

export interface Verdict {
  kind: VerdictKind;
  rival: DimItem | undefined;
  gains: string[];
  losses: string[];
}

/** Best verdict across the shown sheets, plus the modes that gave it */
export interface ModeVerdict extends Verdict {
  modes: Mode[];
  /** Every shown sheet rated the roll and they all agree */
  unanimous: boolean;
}

export interface Contender {
  item: DimItem;
  read: Assessment;
}

const hitSlots = (read: Assessment): Set<number> =>
  new Set(read.slots.filter((slot) => slot.matched).map((slot) => slot.slot));

const relate = (mine: Set<number>, theirs: Set<number>): VerdictKind => {
  const gained = [...mine].some((slot) => !theirs.has(slot));
  const lost = [...theirs].some((slot) => !mine.has(slot));

  if (!gained && !lost) {
    return "equal";
  }

  if (!lost) {
    return "better";
  }

  if (!gained) {
    return "worse";
  }

  return "mixed";
};

const rolledNames = (read: Assessment, slots: Set<number>): string[] =>
  read.slots.flatMap((slot) =>
    slots.has(slot.slot) && slot.rolled ? [slot.rolled.name] : [],
  );

export const verdictOf = (mine: Assessment, rivals: Contender[]): Verdict => {
  const held = hitSlots(mine);

  if (rivals.length === 0) {
    return { kind: "only", rival: undefined, gains: [], losses: [] };
  }

  const scored = rivals
    .map((rival) => ({ ...rival, hits: hitSlots(rival.read) }))
    .sort((a, b) => b.hits.size - a.hits.size);

  const against = (rival: (typeof scored)[number]) => ({
    gains: rolledNames(
      mine,
      new Set([...held].filter((slot) => !rival.hits.has(slot))),
    ),
    losses: rolledNames(
      rival.read,
      new Set([...rival.hits].filter((slot) => !held.has(slot))),
    ),
  });

  const dominator = scored.find((rival) => relate(held, rival.hits) === "worse");

  if (dominator) {
    return { kind: "worse", rival: dominator.item, ...against(dominator) };
  }

  const twin = scored.find((rival) => relate(held, rival.hits) === "equal");

  if (twin) {
    return { kind: "equal", rival: twin.item, gains: [], losses: [] };
  }

  if (scored.every((rival) => relate(held, rival.hits) === "better")) {
    return { kind: "better", rival: scored[0]!.item, ...against(scored[0]!) };
  }

  // The three checks above guarantee one exists
  const mixed = scored.find((rival) => relate(held, rival.hits) === "mixed")!;

  return { kind: "mixed", rival: mixed.item, ...against(mixed) };
};

const STANDING: VerdictKind[] = ["only", "better", "mixed", "equal", "worse"];

export const combineVerdicts = (
  verdicts: Partial<Record<Mode, Verdict>>,
  shown: Mode[],
): ModeVerdict | undefined => {
  const rated = shown.flatMap((mode) => {
    const verdict = verdicts[mode];

    return verdict ? [{ mode, verdict }] : [];
  });

  if (rated.length === 0) {
    return undefined;
  }

  // Won't be undefined, rated is not empty
  const best = minBy(rated, (entry) => STANDING.indexOf(entry.verdict.kind))!;

  const modes = rated
    .filter((entry) => entry.verdict.kind === best.verdict.kind)
    .map((entry) => entry.mode);

  return {
    ...best.verdict,
    modes,
    unanimous: rated.length === shown.length && modes.length === rated.length,
  };
};

const verdictIn = (
  item: DimItem,
  stores: DimStore[],
  mode: Mode,
): Verdict | undefined => {
  const read = assess(item, mode);

  if (!read || read.of === 0) {
    return undefined;
  }

  const versions = new Set(versionsOf(item.hash, mode));

  const rivals = stores
    .flatMap((store) => store.items)
    .filter(
      (other) =>
        versions.has(other.hash) &&
        other.id !== item.id &&
        other.id !== "0" &&
        !!other.sockets &&
        !other.sockets.fromDefinitions,
    )
    .flatMap((other) => {
      const rival = assess(other, mode);

      return rival ? [{ item: other, read: rival }] : [];
    });

  return verdictOf(read, rivals);
};

/** Mode names behind a verdict, undefined when the sheets agree */
export const verdictMode = (verdict: ModeVerdict): string | undefined => {
  if (verdict.kind === "only" || verdict.unanimous) {
    return undefined;
  }

  return verdict.modes.map((mode) => MODE_NAMES[mode]).join(" and ");
};

/** Verdict across the shown modes, undefined without real sockets or a rating */
export const verdictFor = (
  item: DimItem,
  stores: DimStore[],
  shown: Mode[],
): ModeVerdict | undefined => {
  if (!item.sockets || item.sockets.fromDefinitions) {
    return undefined;
  }

  const verdicts: Partial<Record<Mode, Verdict>> = {};

  for (const mode of shown) {
    verdicts[mode] = verdictIn(item, stores, mode);
  }

  return combineVerdicts(verdicts, shown);
};
