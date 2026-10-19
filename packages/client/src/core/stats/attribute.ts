import { maxBy } from "es-toolkit";

import type { HistoryRun } from "../activities/history.ts";
import { MINUTE } from "../time.ts";
import type { Change } from "./types.ts";

/** End of activity rewards land up to this long after the next activity starts */
export const GRACE = MINUTE;

/** A mint window longer than this means nobody was watching */
export const AWAY = 5 * MINUTE;

// Orbit's activity def has no name
export const ORBIT = 82913930;

const RUN_MATCH = 2 * MINUTE;

export interface Span {
  characterId: string;
  activityHash: number;
  modeHash: number;
  playlistHash: number;
  startedAt: number;
  endedAt: number | undefined;
  reportedAt: number;
}

export interface Attribution {
  span: Span | undefined;
  alternative: Span | undefined;
  away: boolean;
}

/** In game activity spans per character, each ending where the next begins */
export const spansOf = (changes: Change[]): Span[] => {
  const byCharacter = new Map<string, Span[]>();
  const observed = changes
    .filter((change) => change.kind === "activity")
    .sort((a, b) => a.at - b.at);

  for (const change of observed) {
    const spans = byCharacter.get(change.characterId) ?? [];
    const last = spans.at(-1);

    // Two recorders can log the same transition
    if (
      last?.activityHash === change.activityHash &&
      last.reportedAt === change.startedAt
    ) {
      continue;
    }

    spans.push({
      characterId: change.characterId,
      activityHash: change.activityHash,
      modeHash: change.modeHash,
      playlistHash: change.playlistHash,
      // Orbit reports the start of the activity just left, so the window bounds it
      startedAt: Math.min(Math.max(change.startedAt, change.from), change.at),
      endedAt: undefined,
      reportedAt: change.startedAt,
    });
    byCharacter.set(change.characterId, spans);
  }

  for (const spans of byCharacter.values()) {
    for (let index = 0; index < spans.length - 1; index++) {
      spans[index]!.endedAt = spans[index + 1]!.startedAt;
    }
  }

  const all = [...byCharacter.values()].flat();

  // One character plays at a time, and a logged out one reads as in game for a while
  for (const span of all) {
    for (const other of all) {
      if (
        other.characterId !== span.characterId &&
        other.activityHash !== 0 &&
        other.startedAt > span.startedAt &&
        (span.endedAt === undefined || other.startedAt < span.endedAt)
      ) {
        span.endedAt = other.startedAt;
      }
    }
  }

  return all.filter((span) => span.activityHash !== 0);
};

const covers = (span: Span, at: number): boolean =>
  span.startedAt <= at && (span.endedAt === undefined || at < span.endedAt);

/** Which activity a change belongs to. Inside GRACE of a transition it leans to the ended one if leansTo allows */
export const attribute = (
  change: Pick<Change, "from" | "at"> & { characterId?: string | undefined },
  spans: Span[],
  leansTo: (ended: Span) => boolean = () => true,
): Attribution => {
  if (change.at - change.from > AWAY) {
    return { span: undefined, alternative: undefined, away: true };
  }

  // The latest start is the character playing
  const characterId =
    change.characterId ??
    maxBy(
      spans.filter((span) => span.startedAt <= change.at),
      (span) => span.startedAt,
    )?.characterId;
  const candidates =
    characterId === undefined
      ? spans
      : spans.filter((span) => span.characterId === characterId);

  const ended = maxBy(
    candidates.filter(
      (span) =>
        span.endedAt !== undefined &&
        span.endedAt <= change.at &&
        leansTo(span) &&
        (change.at - span.endedAt <= GRACE || change.from < span.endedAt),
    ),
    (span) => span.endedAt!,
  );
  const current = candidates.find((span) => covers(span, change.at));

  if (ended) {
    return {
      span: ended,
      alternative: current?.startedAt === ended.endedAt ? current : undefined,
      away: false,
    };
  }

  return { span: current, alternative: undefined, away: false };
};

/** The history run a live span became, matched on character, activity, and start time */
export const runOf = (
  span: Span,
  runs: HistoryRun[],
): HistoryRun | undefined => {
  // A short orbit stop starts near the next run, so time alone hands it that run
  const hashes = new Set([span.activityHash, span.playlistHash]);
  let best: HistoryRun | undefined = undefined;

  for (const run of runs) {
    const gap = Math.abs(run.startedAt - span.startedAt);

    if (
      run.characterId === span.characterId &&
      (hashes.has(run.referenceId) || hashes.has(run.directorActivityHash)) &&
      gap <= RUN_MATCH &&
      (best === undefined || gap < Math.abs(best.startedAt - span.startedAt))
    ) {
      best = run;
    }
  }

  return best;
};
