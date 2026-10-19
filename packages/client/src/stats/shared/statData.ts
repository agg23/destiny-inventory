import { killTrackerObjectivesByHash } from "app/search/d2-known-values";

import {
  attribute,
  ORBIT,
  spansOf,
  type Span,
} from "../../core/stats/attribute.ts";
import type { Change } from "../../core/stats/types.ts";
import { localDay } from "../../core/activities/history.ts";
import { DAY, HOUR } from "../../core/time.ts";
import type { KillMode, StatPeriod } from "../../core/url.ts";

export const PERIODS: { id: StatPeriod; label: string; length: number }[] = [
  { id: "24h", label: "Last 24 hours", length: DAY },
  { id: "7d", label: "Last 7 days", length: 7 * DAY },
  { id: "30d", label: "Last 30 days", length: 30 * DAY },
  { id: "all", label: "All time", length: Number.POSITIVE_INFINITY },
];

/** Always shown at the top of the page, in this order */
export const MAIN_CURRENCIES = [
  3159615086, // Glimmer
  2817410917, // Bright Dust
  3147280338, // Silver
  800069450, // Strange Coin
  402110270, // Legendary Mark
  3853748946, // Enhancement Core
  4257549984, // Enhancement Prism
  4257549985, // Ascendant Shard
  353704689, // Ascendant Alloy
  3467984096, // Exotic Cipher
];

/** Changes this far before the period are read for the activity already running at its start */
export const LOOKBACK = 2 * HOUR;

export interface Balance {
  itemHash: number;
  currency: boolean;
  now: number;
  delta: number;
  points: [number, number][];
}

export const balancesOf = (
  changes: Change[],
  from: number,
  to: number,
): Balance[] => {
  const byHash = new Map<number, Balance>();

  for (const change of changes) {
    if (
      (change.kind !== "currency" && change.kind !== "stack") ||
      change.at < from
    ) {
      continue;
    }

    const held = byHash.get(change.itemHash) ?? {
      itemHash: change.itemHash,
      currency: change.kind === "currency",
      now: change.before,
      delta: 0,
      points: [[Math.max(from, change.from), change.before]],
    };

    held.points.push([change.at, change.after]);
    held.delta += change.after - change.before;
    held.now = change.after;
    byHash.set(change.itemHash, held);
  }

  const balances = [...byHash.values()];

  for (const balance of balances) {
    balance.points.push([to, balance.now]);
  }

  return balances.sort(
    (a, b) =>
      Number(b.currency) - Number(a.currency) ||
      Math.abs(b.delta) - Math.abs(a.delta),
  );
};

type KillChange = Extract<Change, { kind: "objective" }>;

const killChange = (change: Change): change is KillChange =>
  change.kind === "objective" &&
  killTrackerObjectivesByHash[change.objectiveHash] !== undefined &&
  change.after > change.before;

export interface WeaponKills {
  instanceId: string;
  itemHash: number;
  pve: number;
  pvp: number;
}

// Gambit trackers count with PvE
export const weaponKillsOf = (
  changes: Change[],
  from: number,
): WeaponKills[] => {
  const byInstance = new Map<string, WeaponKills>();

  for (const change of changes) {
    if (!killChange(change) || change.at < from) {
      continue;
    }

    const held = byInstance.get(change.instanceId) ?? {
      instanceId: change.instanceId,
      itemHash: change.itemHash,
      pve: 0,
      pvp: 0,
    };
    const kills = change.after - change.before;

    if (killTrackerObjectivesByHash[change.objectiveHash] === "pvp") {
      held.pvp += kills;
    } else {
      held.pve += kills;
    }

    byInstance.set(change.instanceId, held);
  }

  return [...byInstance.values()].sort(
    (a, b) => b.pve + b.pvp - (a.pve + a.pvp),
  );
};

// Kinetic, energy, power
const WEAPON_BUCKETS = new Set([1498876634, 2465295065, 953998645]);

export interface Drop {
  instanceId: string;
  itemHash: number;
  at: number;
  alternative: Span | undefined;
}

export interface Dropped {
  span: Span | undefined;
  at: number;
}

export type LogEvent =
  | { key: string; kind: "drops"; at: number; drops: Drop[] }
  | {
      key: string;
      kind: "dismantle";
      at: number;
      instanceId: string;
      itemHash: number;
      dropped: Dropped | undefined;
    }
  | {
      key: string;
      kind: "equip";
      at: number;
      instanceId: string;
      itemHash: number;
    };

export interface Gain {
  itemHash: number;
  delta: number;
}

export interface ActivityDigest {
  key: string;
  span: Span | undefined;
  away: { from: number; at: number } | undefined;
  events: LogEvent[];
  kills: number;
  gains: Gain[];
}

interface Tally extends Omit<ActivityDigest, "gains"> {
  gains: Map<number, number>;
}

export const spanKey = (span: Span) => `${span.characterId}/${span.startedAt}`;

const emptyTally = (
  key: string,
  span: Span | undefined,
  away: ActivityDigest["away"],
): Tally => ({
  key,
  span,
  away,
  events: [],
  kills: 0,
  gains: new Map(),
});

// Spending, dismantling, and swapping happen where you are; orbit has no kills
const leansFor =
  (change: Change) =>
  (ended: Span): boolean => {
    if (change.kind === "currency" || change.kind === "stack") {
      return change.after > change.before;
    }

    if (change.kind === "item") {
      return change.added;
    }

    return change.kind === "objective" && ended.activityHash !== ORBIT;
  };

const attributed = (change: Change, spans: Span[]) =>
  attribute(
    {
      from: change.from,
      at: change.at,
      characterId:
        change.kind === "item" || change.kind === "equip"
          ? change.characterId
          : undefined,
    },
    spans,
    leansFor(change),
  );

const overlaps = (span: Span, from: number, to: number): boolean =>
  span.startedAt <= to && (span.endedAt === undefined || span.endedAt >= from);

/** Timed drops, dismantles, and weapon swaps per activity in the period, newest first */
export const activityDigestsOf = (
  changes: Change[],
  from: number,
  to: number,
): ActivityDigest[] => {
  const spans = spansOf(changes);
  const tallies = new Map<string, Tally>();
  const latest = new Map<string, number>();
  const dropsById = new Map<string, Dropped>();

  for (const span of spans) {
    if (overlaps(span, from, to)) {
      tallies.set(spanKey(span), emptyTally(spanKey(span), span, undefined));
      latest.set(spanKey(span), span.startedAt);
    }
  }

  for (const change of changes) {
    const wanted =
      change.kind === "item" ||
      change.kind === "currency" ||
      change.kind === "stack" ||
      (change.kind === "equip" && WEAPON_BUCKETS.has(change.bucketHash)) ||
      killChange(change);

    if (!wanted || change.at < from || change.at > to) {
      continue;
    }

    const found = attributed(change, spans);

    let key = "unknown";

    if (found.away) {
      key = `away/${change.at}`;
    } else if (found.span) {
      key = spanKey(found.span);
    }

    const tally =
      tallies.get(key) ??
      emptyTally(
        key,
        found.span,
        found.away ? { from: change.from, at: change.at } : undefined,
      );
    const last = tally.events.at(-1);

    if (change.kind === "item" && change.added) {
      const drop = {
        instanceId: change.instanceId,
        itemHash: change.itemHash,
        at: change.at,
        alternative: found.alternative,
      };

      dropsById.set(change.instanceId, { span: found.span, at: change.at });

      // One snapshot's drops share a row, like a completion chest
      if (last?.kind === "drops" && last.at === change.at) {
        last.drops.push(drop);
      } else {
        tally.events.push({
          key: `drops/${change.at}`,
          kind: "drops",
          at: change.at,
          drops: [drop],
        });
      }
    } else if (change.kind === "item") {
      tally.events.push({
        key: `dismantle/${change.instanceId}`,
        kind: "dismantle",
        at: change.at,
        instanceId: change.instanceId,
        itemHash: change.itemHash,
        dropped: dropsById.get(change.instanceId),
      });
    } else if (change.kind === "equip") {
      tally.events.push({
        key: `equip/${change.at}/${change.instanceId}`,
        kind: "equip",
        at: change.at,
        instanceId: change.instanceId,
        itemHash: change.itemHash,
      });
    } else if (change.kind === "currency" || change.kind === "stack") {
      tally.gains.set(
        change.itemHash,
        (tally.gains.get(change.itemHash) ?? 0) + change.after - change.before,
      );
    } else if (change.kind === "objective") {
      tally.kills += change.after - change.before;
    }

    tallies.set(key, tally);
    latest.set(key, Math.max(latest.get(key) ?? 0, change.at));
  }

  return [...tallies.values()]
    .sort(
      (a, b) =>
        (b.span?.startedAt ?? latest.get(b.key) ?? 0) -
        (a.span?.startedAt ?? latest.get(a.key) ?? 0),
    )
    .map((tally) => ({
      ...tally,
      gains: [...tally.gains]
        .flatMap(([itemHash, delta]) =>
          delta === 0 ? [] : [{ itemHash, delta }],
        )
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    }));
};

/** Every drop in a digest, oldest first */
export const dropsOf = (digest: ActivityDigest): Drop[] =>
  digest.events.flatMap((event) => (event.kind === "drops" ? event.drops : []));

/** Earned and spent of one currency per activity, keyed by spanKey */
export const spanFlowsOf = (
  changes: Change[],
  from: number,
  to: number,
  itemHash: number,
): Map<string, { earned: number; spent: number }> => {
  const spans = spansOf(changes);
  const flows = new Map<string, { earned: number; spent: number }>();

  for (const change of changes) {
    if (
      (change.kind !== "currency" && change.kind !== "stack") ||
      change.itemHash !== itemHash ||
      change.at < from ||
      change.at > to
    ) {
      continue;
    }

    const found = attributed(change, spans);

    if (!found.span) {
      continue;
    }

    const key = spanKey(found.span);
    const held = flows.get(key) ?? { earned: 0, spent: 0 };
    const delta = change.after - change.before;

    if (delta > 0) {
      held.earned += delta;
    } else {
      held.spent -= delta;
    }

    flows.set(key, held);
  }

  return flows;
};

export interface Earning {
  label: string;
  runs: number;
  earned: number;
  seconds: number;
}

/** What each activity earned of one currency, gains only, grouped by label */
export const earningsOf = (
  changes: Change[],
  from: number,
  to: number,
  itemHash: number,
  labelOf: (span: Span) => string,
): Earning[] => {
  const spans = spansOf(changes);
  const rows = new Map<string, Earning>();

  const rowOf = (span: Span): Earning => {
    const label = labelOf(span);
    const held = rows.get(label) ?? { label, runs: 0, earned: 0, seconds: 0 };

    rows.set(label, held);

    return held;
  };

  for (const span of spans) {
    if (!overlaps(span, from, to)) {
      continue;
    }

    const row = rowOf(span);
    const start = Math.max(span.startedAt, from);
    const end = Math.min(span.endedAt ?? to, to);

    row.runs += 1;
    row.seconds += Math.max(0, end - start) / 1000;
  }

  for (const change of changes) {
    if (
      (change.kind !== "currency" && change.kind !== "stack") ||
      change.itemHash !== itemHash ||
      change.after <= change.before ||
      change.at < from ||
      change.at > to
    ) {
      continue;
    }

    const found = attributed(change, spans);

    if (found.span) {
      rowOf(found.span).earned += change.after - change.before;
    }
  }

  return [...rows.values()]
    .filter((row) => row.earned > 0)
    .sort((a, b) => b.earned - a.earned);
};

/** Local midnight of the day holding `at` */
export const midnight = (at: number): number => {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);

  return date.getTime();
};

/** Local midnight after `at`. DST days run 23 or 25 hours */
export const nextMidnight = (at: number): number => {
  const date = new Date(midnight(at));
  date.setDate(date.getDate() + 1);

  return date.getTime();
};

/** Hourly buckets up to two days, daily past that */
export const bucketSizeFor = (from: number, to: number): number =>
  to - from <= 2 * DAY ? HOUR : DAY;

export interface Flow {
  start: number;
  earned: number;
  spent: number;
}

/** Earned and spent of one currency per bucket, empty buckets included */
export const flowsOf = (
  changes: Change[],
  from: number,
  to: number,
  itemHash: number,
): { daily: boolean; flows: Flow[] } => {
  const mine = changes.filter(
    (change) =>
      (change.kind === "currency" || change.kind === "stack") &&
      change.itemHash === itemHash &&
      change.at >= from &&
      change.at <= to,
  );
  const first = mine[0]?.at;

  if (first === undefined) {
    return { daily: false, flows: [] };
  }

  const size = bucketSizeFor(from, to);
  const startOf = (at: number) =>
    size === DAY ? midnight(at) : Math.floor(at / HOUR) * HOUR;
  const nextOf = (at: number) => (size === DAY ? nextMidnight(at) : at + HOUR);
  const flows: Flow[] = [];

  // All time has no start of its own
  for (let at = startOf(from > 0 ? from : first); at <= to; at = nextOf(at)) {
    flows.push({ start: at, earned: 0, spent: 0 });
  }

  for (const change of mine) {
    if (change.kind !== "currency" && change.kind !== "stack") {
      continue;
    }

    const flow = flows.find(
      (one) => one.start <= change.at && change.at < nextOf(one.start),
    );
    const delta = change.after - change.before;

    if (!flow) {
      continue;
    }

    if (delta > 0) {
      flow.earned += delta;
    } else {
      flow.spent -= delta;
    }
  }

  return { daily: size === DAY, flows };
};

export interface PlayDay {
  day: string;
  start: number;
  active: number;
  social: number;
}

/** Seconds played per local day, split into activities and social spaces */
export const playDaysOf = (
  spans: Span[],
  from: number,
  to: number,
  social: (span: Span) => boolean,
): PlayDay[] => {
  const first = Math.min(...spans.map((span) => span.startedAt));

  if (!Number.isFinite(first)) {
    return [];
  }

  const days: PlayDay[] = [];

  // All time has no start of its own
  for (
    let at = midnight(from > 0 ? from : first);
    at <= to;
    at = nextMidnight(at)
  ) {
    const end = nextMidnight(at);
    const day: PlayDay = { day: localDay(at), start: at, active: 0, social: 0 };

    for (const span of spans) {
      const seconds =
        Math.max(
          0,
          Math.min(span.endedAt ?? to, end, to) - Math.max(span.startedAt, at),
        ) / 1000;

      if (social(span)) {
        day.social += seconds;
      } else {
        day.active += seconds;
      }
    }

    days.push(day);
  }

  return days;
};

export interface KillBar {
  key: string;
  start: number;
  end: number;
  span: Span | undefined;
  total: number;
  byWeapon: Map<string, { itemHash: number; kills: number }>;
}

/** Tracker kills per activity, local day, or fixed interval in ms, for the weapons `include` accepts */
export const killBarsOf = (
  changes: Change[],
  from: number,
  to: number,
  mode: KillMode,
  grouping: "activity" | "day" | number,
  include: (instanceId: string) => boolean,
): KillBar[] => {
  const spans = spansOf(changes);
  const bars = new Map<string, KillBar>();

  for (const change of changes) {
    if (
      !killChange(change) ||
      change.at < from ||
      change.at > to ||
      !include(change.instanceId)
    ) {
      continue;
    }

    const kind = killTrackerObjectivesByHash[change.objectiveHash];

    if (
      (mode === "pve" && kind === "pvp") ||
      (mode === "pvp" && kind !== "pvp")
    ) {
      continue;
    }

    let bar: KillBar | undefined = undefined;

    if (typeof grouping === "number") {
      const start = Math.floor(change.at / grouping) * grouping;
      const key = String(start);

      bar = bars.get(key) ?? {
        key,
        start,
        end: start + grouping,
        span: undefined,
        total: 0,
        byWeapon: new Map(),
      };
    } else if (grouping === "day") {
      const start = midnight(change.at);
      const key = localDay(start);

      bar = bars.get(key) ?? {
        key,
        start,
        end: nextMidnight(start),
        span: undefined,
        total: 0,
        byWeapon: new Map(),
      };
    } else {
      const found = attributed(change, spans).span;

      if (!found) {
        continue;
      }

      const key = spanKey(found);

      bar = bars.get(key) ?? {
        key,
        start: found.startedAt,
        end: found.endedAt ?? to,
        span: found,
        total: 0,
        byWeapon: new Map(),
      };
    }

    const kills = change.after - change.before;
    const weapon = bar.byWeapon.get(change.instanceId) ?? {
      itemHash: change.itemHash,
      kills: 0,
    };

    weapon.kills += kills;
    bar.total += kills;
    bar.byWeapon.set(change.instanceId, weapon);
    bars.set(bar.key, bar);
  }

  return [...bars.values()].sort((a, b) => a.start - b.start);
};
