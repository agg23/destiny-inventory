// The unmutated week only exists just after reset; this captures it then and serves it all week

const PLATFORM = "https://www.bungie.net/Platform";

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

export interface Reference {
  membershipType: number;
  membershipId: string;
}

const anchor = (now: Date): number =>
  Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    RESET_HOUR,
  );

// Before the hour, today's reset has not happened yet, so the window is the previous one
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

// Merged across characters so a class-specific focus does not depend on capture order
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

      // The fullest payload wins, since a capture can race a character who already played
      if (!held || rewards.length > held.length) {
        rows[activity.activityHash] = rewards;
      }
    }
  }

  return rows;
};

export const capture = async (
  apiKey: string,
  reference: Reference,
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

  // A capture from a spent week describes a week that is over
  return held?.week === weekStart(now) ? held : undefined;
};

export const refresh = async (
  store: Store,
  apiKey: string,
  reference: Reference,
  now: Date,
): Promise<Baseline> => {
  const held = await readBaseline(store, now);

  // The weekly counters are what a tile reports, so a daily run only fills a gap
  if (held) {
    return held;
  }

  const fresh = await capture(apiKey, reference, now);
  await store.put(KEY, JSON.stringify(fresh));

  return fresh;
};
