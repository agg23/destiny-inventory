// Unspent weekly state only exists just after reset
import { PLATFORM, type Membership } from "./bungie.ts";

// Destiny turns its week over on Tuesday at 17:00 UTC and its day at 17:00 every day
const RESET_DAY = 2;
const RESET_HOUR = 17;
const DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export interface Reward {
  style: string;
  itemHash: number;
  quantity: number;
}

export interface Baseline {
  week: string;
  day: string;
  capturedAt: string;
  rows: Record<number, Reward[]>;
}

export interface Store {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
}

const anchor = (now: Date): number =>
  Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    RESET_HOUR,
  );

// Before 17:00 the window is the previous one
const back = (candidate: number, now: Date, span: number): string =>
  new Date(
    candidate > now.getTime() ? candidate - span : candidate,
  ).toISOString();

export const dayStart = (now: Date): string => back(anchor(now), now, DAY);

export const weekStart = (now: Date): string => {
  const behind = (now.getUTCDay() - RESET_DAY + DAYS) % DAYS;

  return back(anchor(now) - behind * DAY, now, DAYS * DAY);
};

const KEY = "baseline";

interface LiveReward {
  uiStyle?: string;
  itemQuantity: { itemHash: number; quantity: number };
}

interface LiveActivity {
  activityHash: number;
  isVisible?: boolean;
  visibleRewards?: { rewardItems: LiveReward[] }[];
}

interface Live {
  Response?: {
    characterActivities?: {
      data?: Record<string, { availableActivities: LiveActivity[] }>;
    };
  };
  ErrorCode?: number;
}

// Merge across characters. Class-specific focuses differ per character
const collapse = (
  characters: Record<string, { availableActivities: LiveActivity[] }>,
): Record<number, Reward[]> => {
  const rows: Record<number, Reward[]> = {};

  for (const character of Object.values(characters)) {
    for (const activity of character.availableActivities) {
      if (activity.isVisible === false) {
        continue;
      }

      const rewards = (activity.visibleRewards ?? []).flatMap((group) =>
        group.rewardItems.map((item) => ({
          style: item.uiStyle ?? "",
          itemHash: item.itemQuantity.itemHash,
          quantity: item.itemQuantity.quantity,
        })),
      );

      const held = rows[activity.activityHash];

      // Fullest wins. A character may have already played
      if (!held || rewards.length > held.length) {
        rows[activity.activityHash] = rewards;
      }
    }
  }

  return rows;
};

export const capture = async (
  apiKey: string,
  reference: Membership,
  now: Date,
): Promise<Baseline> => {
  const response = await fetch(
    `${PLATFORM}/Destiny2/${reference.membershipType}/Profile/${reference.membershipId}/?components=204`,
    { headers: { "X-API-Key": apiKey } },
  );

  const body = (await response.json()) as Live;
  const characters = body.Response?.characterActivities?.data;

  if (!characters) {
    throw new Error("Reference profile returned no character activities");
  }

  return {
    week: weekStart(now),
    day: dayStart(now),
    capturedAt: now.toISOString(),
    rows: collapse(characters),
  };
};

export const readBaseline = async (
  store: Store,
  now: Date,
): Promise<Baseline | undefined> => {
  const raw = await store.get(KEY);
  const held = raw ? (JSON.parse(raw) as Baseline) : undefined;

  return held?.week === weekStart(now) ? held : undefined;
};

export const refresh = async (
  store: Store,
  apiKey: string,
  reference: Membership,
  now: Date,
): Promise<Baseline> => {
  const held = await readBaseline(store, now);

  // Daily runs only fill a missing week
  if (held) {
    return held;
  }

  const fresh = await capture(apiKey, reference, now);
  await store.put(KEY, JSON.stringify(fresh));

  return fresh;
};
