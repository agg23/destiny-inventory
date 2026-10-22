import {
  DestinyProgressionScope,
  type DestinyProfileResponse,
} from "bungie-api-ts/destiny2";
import { silverItemHash } from "app/search/d2-known-values";
import { createSignal } from "solid-js";

import { STAT_BUCKET, type StatChunk, type StatCursor } from "@dvm/service";

import { callService } from "../api/auth.ts";
import { defs } from "../profile/defs.ts";
import { PROFILE, STAT_CHUNKS, type DefStore } from "../profile/store.ts";
import { readStored, writeStored } from "../storage.ts";
import { diff, observe, snapshotOf } from "./observe.ts";
import type { Change, Chunk, Observed } from "./types.ts";

/** Chunks are fixed wall clock buckets this long, synced once they close */
export const SYNC_INTERVAL = STAT_BUCKET;

const ENDPOINT = "/api/stats";

const LAST = Number.MAX_SAFE_INTEGER;

interface Recorder {
  store: DefStore;
  membershipId: string;
  leader: boolean;
}

let recorder: Recorder | undefined = undefined;
let queue: Promise<void> = Promise.resolve();

const [version, setVersion] = createSignal(0);

/** Bumps whenever recorded changes land in IndexedDB */
export const statsVersion = version;

const bump = () => setVersion((was) => was + 1);

/** Start of the bucket holding `at` */
export const bucketOf = (at: number): number =>
  Math.floor(at / SYNC_INTERVAL) * SYNC_INTERVAL;

const observedKey = (membershipId: string) => `observed/${membershipId}`;
const pushedKey = (membershipId: string) => `dvm.stats.pushed/${membershipId}`;
const cursorKey = (membershipId: string) => `dvm.stats.cursor/${membershipId}`;

const enqueue = (step: () => Promise<void>): Promise<void> => {
  queue = queue
    .then(step)
    .catch((e: unknown) => console.warn("Stats failed", e));

  return queue;
};

const chunkAt = async (
  held: Recorder,
  startsAt: number,
): Promise<Chunk | undefined> => {
  const [found] = await held.store.getRange<Chunk>(
    STAT_CHUNKS,
    [held.membershipId, startsAt],
    [held.membershipId, startsAt],
  );

  return found;
};

const accountWide = (progressionHash: number): boolean =>
  defs()?.Progression.getOptional(progressionHash)?.scope ===
  DestinyProgressionScope.Account;

const record = async (held: Recorder, profile: DestinyProfileResponse) => {
  const now = observe(profile, accountWide);
  // Never cached in memory. Another tab may have recorded since
  const was = await held.store.getOne<Observed>(
    PROFILE,
    observedKey(held.membershipId),
  );

  // Bungie's cache can hand back older mints
  if (was && now.minted <= was.minted) {
    return;
  }

  // Bungie only sends Silver while in game
  const silver = was?.currencies[silverItemHash];

  if (silver !== undefined && now.currencies[silverItemHash] === undefined) {
    now.currencies[silverItemHash] = silver;
  }

  await held.store.putOne(PROFILE, observedKey(held.membershipId), now);

  if (!was) {
    return;
  }

  const changes = diff(was, now).map((change) =>
    change.kind === "item" && change.added
      ? { ...change, snapshot: snapshotOf(profile, change.instanceId, defs()) }
      : change,
  );

  if (changes.length === 0) {
    return;
  }

  const startsAt = bucketOf(Date.now());
  const chunk: Chunk = (await chunkAt(held, startsAt)) ?? {
    membershipId: held.membershipId,
    startsAt,
    endsAt: startsAt + SYNC_INTERVAL,
    changes: [],
    synced: false,
  };

  await held.store.putAll(STAT_CHUNKS, [
    { ...chunk, changes: [...chunk.changes, ...changes], synced: false },
  ]);
  bump();
};

/** Diffs a live profile against the last one and logs the changes. Only the leader tab records */
export const recordProfile = (
  membershipId: string,
  profile: DestinyProfileResponse,
): Promise<void> => {
  const held = recorder;

  if (!held?.leader || held.membershipId !== membershipId) {
    return Promise.resolve();
  }

  return enqueue(() => record(held, profile));
};

const push = async (held: Recorder) => {
  const after =
    (readStored(pushedKey(held.membershipId)) as number | undefined) ?? 0;
  const open = bucketOf(Date.now());

  if (open <= after + 1) {
    return;
  }

  const pending = (
    await held.store.getRange<Chunk>(
      STAT_CHUNKS,
      [held.membershipId, after + 1],
      [held.membershipId, open - 1],
    )
  ).filter((chunk) => !chunk.synced);

  for (const chunk of pending) {
    const response = await callService(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        startsAt: chunk.startsAt,
        endsAt: chunk.endsAt,
        body: JSON.stringify(chunk.changes),
      }),
    });

    // The cursor must never pass an unsent chunk
    if (!response?.ok) {
      return;
    }

    let sent = false;

    await enqueue(async () => {
      const current = await chunkAt(held, chunk.startsAt);

      // A late record landed while posting, so the next push resends it
      if (current && current.changes.length === chunk.changes.length) {
        await held.store.putAll(STAT_CHUNKS, [{ ...current, synced: true }]);
        sent = true;
      }
    });

    if (!sent) {
      return;
    }

    writeStored(pushedKey(held.membershipId), chunk.startsAt);
  }
};

const pull = async (held: Recorder) => {
  let cursor = (readStored(cursorKey(held.membershipId)) as
    | StatCursor
    | undefined) ?? { updatedAt: 0, startsAt: 0 };
  let landed = false;
  let more = true;

  while (more) {
    const response = await callService(
      `${ENDPOINT}?since=${cursor.updatedAt}&after=${cursor.startsAt}`,
    );

    if (!response?.ok) {
      break;
    }

    const body = (await response.json()) as {
      chunks: StatChunk[];
      more: boolean;
    };
    const open = bucketOf(Date.now());

    // Each bucket keeps one recorder's changes, whichever saw more. Mixing two doubles everything
    await enqueue(async () => {
      for (const incoming of body.chunks) {
        const changes = JSON.parse(incoming.body) as Change[];
        const local = await chunkAt(held, incoming.startsAt);

        if (
          incoming.startsAt >= open ||
          (local && (!local.synced || local.changes.length >= changes.length))
        ) {
          continue;
        }

        await held.store.putAll(STAT_CHUNKS, [
          {
            membershipId: held.membershipId,
            startsAt: incoming.startsAt,
            endsAt: incoming.endsAt,
            changes,
            synced: true,
          },
        ]);
        landed = true;
      }
    });

    const last = body.chunks.at(-1);

    if (last) {
      cursor = { updatedAt: last.updatedAt, startsAt: last.startsAt };
      writeStored(cursorKey(held.membershipId), cursor);
    }

    more = body.more && !!last;
  }

  if (landed) {
    bump();
  }
};

const sync = async (held: Recorder) => {
  if (held.leader) {
    await push(held);
  }

  await pull(held);
};

/** Pulls other machines' chunks, then records and pushes every SYNC_INTERVAL while this tab leads */
export const startStats = (
  store: DefStore,
  membershipId: string,
): (() => void) => {
  const held: Recorder = { store, membershipId, leader: false };
  let release: (() => void) | undefined = undefined;

  recorder = held;

  void navigator.locks.request(
    `dvm.stats/${membershipId}`,
    () =>
      new Promise<void>((resolve) => {
        if (recorder !== held) {
          resolve();

          return;
        }

        held.leader = true;
        release = resolve;
        void push(held).catch((e: unknown) =>
          console.warn("Stats push failed", e),
        );
      }),
  );

  void pull(held).catch((e: unknown) => console.warn("Stats pull failed", e));

  const timer = window.setInterval(() => {
    void sync(held).catch((e: unknown) => console.warn("Stats sync failed", e));
  }, SYNC_INTERVAL);

  return () => {
    window.clearInterval(timer);
    held.leader = false;
    release?.();

    if (recorder === held) {
      recorder = undefined;
    }
  };
};

/** The last profile observation, for current balances */
export const lastObserved = (
  store: DefStore,
  membershipId: string,
): Promise<Observed | undefined> =>
  store.getOne<Observed>(PROFILE, observedKey(membershipId));

/** Recorded changes seen from `from` to `to`, oldest first */
export const changesBetween = async (
  store: DefStore,
  membershipId: string,
  from: number,
  to: number,
): Promise<Change[]> => {
  // A mint can be a little older than the bucket it was recorded in
  const chunks = await store.getRange<Chunk>(
    STAT_CHUNKS,
    [membershipId, Math.max(0, from - SYNC_INTERVAL)],
    [membershipId, Math.min(LAST, to)],
  );

  return chunks
    .flatMap((chunk) => chunk.changes)
    .filter((change) => change.at >= from && change.at <= to)
    .sort((a, b) => a.at - b.at);
};
