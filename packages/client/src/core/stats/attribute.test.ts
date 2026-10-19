import { describe, expect, it } from "vitest";

import type { HistoryRun } from "../activities/history.ts";
import { MINUTE } from "../time.ts";
import { attribute, runOf, spansOf } from "./attribute.ts";
import type { Change } from "./types.ts";

const START = 1_000_000_000_000;

const activity = (
  characterId: string,
  activityHash: number,
  startedAt: number,
): Change => ({
  kind: "activity",
  characterId,
  activityHash,
  modeHash: 0,
  playlistHash: 0,
  startedAt,
  from: startedAt - 15_000,
  at: startedAt + 5_000,
});

const transition = (
  characterId: string,
  activityHash: number,
  reportedStart: number,
  from: number,
  at: number,
): Change => ({
  ...activity(characterId, activityHash, reportedStart),
  from,
  at,
});

const seen = (at: number, from = at - 15_000, characterId = "c1") => ({
  characterId,
  from,
  at,
});

const STRIKE = 10;
const ORBIT = 20;

// Strike, orbit from 20 minutes in, logged out at 30
const spans = spansOf([
  activity("c1", STRIKE, START),
  activity("c1", ORBIT, START + 20 * MINUTE),
  activity("c1", 0, START + 30 * MINUTE),
]);

describe("stats attribution", () => {
  it("ends each span where the next begins and drops the time out of game", () => {
    expect(spans.map((span) => [span.activityHash, span.endedAt])).toEqual([
      [STRIKE, START + 20 * MINUTE],
      [ORBIT, START + 30 * MINUTE],
    ]);
  });

  it("gives a change mid activity to that activity", () => {
    const found = attribute(seen(START + 10 * MINUTE), spans);

    expect(found.span?.activityHash).toBe(STRIKE);
    expect(found.alternative).toBeUndefined();
  });

  it("leans a change just after a transition to the activity that ended", () => {
    const found = attribute(seen(START + 20 * MINUTE + 30_000), spans);

    expect(found.span?.activityHash).toBe(STRIKE);
    expect(found.alternative?.activityHash).toBe(ORBIT);
  });

  it("skips leaning when the caller rules out the ended activity", () => {
    const found = attribute(
      seen(START + 20 * MINUTE + 30_000),
      spans,
      (ended) => ended.activityHash !== STRIKE,
    );

    expect(found.span?.activityHash).toBe(ORBIT);
    expect(found.alternative).toBeUndefined();
  });

  it("gives a change past the grace window to the new activity", () => {
    const found = attribute(seen(START + 22 * MINUTE), spans);

    expect(found.span?.activityHash).toBe(ORBIT);
    expect(found.alternative).toBeUndefined();
  });

  it("treats a window straddling a transition as ambiguous", () => {
    const found = attribute(
      seen(START + 21.5 * MINUTE, START + 19 * MINUTE),
      spans,
    );

    expect(found.span?.activityHash).toBe(STRIKE);
    expect(found.alternative?.activityHash).toBe(ORBIT);
  });

  it("keeps a change right after logging out with the last activity", () => {
    const found = attribute(seen(START + 30 * MINUTE + 20_000), spans);

    expect(found.span?.activityHash).toBe(ORBIT);
    expect(found.alternative).toBeUndefined();
  });

  it("marks a change seen after a long gap as away", () => {
    const found = attribute(
      seen(START + 10 * MINUTE, START - 60 * MINUTE),
      spans,
    );

    expect(found).toEqual({
      span: undefined,
      alternative: undefined,
      away: true,
    });
  });

  it("only looks at the character the item landed on", () => {
    const found = attribute(seen(START + 10 * MINUTE, undefined, "c2"), spans);

    expect(found.span).toBeUndefined();
  });

  it("ends an activity where orbit was first seen when orbit reports the old start", () => {
    const stale = spansOf([
      activity("c1", STRIKE, START),
      transition(
        "c1",
        ORBIT,
        START,
        START + 20 * MINUTE,
        START + 20 * MINUTE + 15_000,
      ),
    ]);

    expect(stale.map((span) => [span.activityHash, span.startedAt])).toEqual([
      [STRIKE, START],
      [ORBIT, START + 20 * MINUTE],
    ]);
    expect(attribute(seen(START + 19 * MINUTE), stale).span?.activityHash).toBe(
      STRIKE,
    );
    expect(
      attribute(seen(START + 20 * MINUTE + 15_000), stale).span?.activityHash,
    ).toBe(STRIKE);
  });

  it("collapses a transition two recorders both logged", () => {
    const doubled = spansOf([
      activity("c1", STRIKE, START),
      transition(
        "c1",
        ORBIT,
        START + 20 * MINUTE,
        START + 19.9 * MINUTE,
        START + 20.1 * MINUTE,
      ),
      transition(
        "c1",
        ORBIT,
        START + 20 * MINUTE,
        START + 20 * MINUTE,
        START + 20.2 * MINUTE,
      ),
    ]);

    expect(doubled.map((span) => span.activityHash)).toEqual([STRIKE, ORBIT]);
  });

  it("gives a change without a character to the one that started playing last", () => {
    const switched = spansOf([
      activity("c1", STRIKE, START),
      activity("c2", ORBIT, START + 5 * MINUTE),
    ]);
    const found = attribute(
      { from: START + 10 * MINUTE - 15_000, at: START + 10 * MINUTE },
      switched,
    );

    expect(found.span?.characterId).toBe("c2");
    expect(switched.find((span) => span.characterId === "c1")?.endedAt).toBe(
      START + 5 * MINUTE,
    );
  });

  it("matches a span to the closest run of the same activity and character", () => {
    const run = (
      instanceId: string,
      characterId: string,
      startedAt: number,
      referenceId = STRIKE,
    ) => ({ instanceId, characterId, startedAt, referenceId }) as HistoryRun;

    const found = runOf(spans[0]!, [
      run("far", "c1", START + 3 * MINUTE),
      run("other", "c2", START),
      run("near", "c1", START + 20_000),
    ]);

    expect(found?.instanceId).toBe("near");
  });

  it("never hands an orbit stop the run that starts right after it", () => {
    const run = {
      instanceId: "next",
      characterId: "c1",
      startedAt: START + 20 * MINUTE + 40_000,
      referenceId: STRIKE,
      directorActivityHash: STRIKE,
    } as HistoryRun;

    expect(runOf(spans[1]!, [run])).toBeUndefined();
  });
});
