import { describe, expect, it } from "vitest";

import { createHandler } from "./handler.ts";
import { mintSession } from "./session.ts";
import {
  isAfter,
  STAT_BUCKET,
  STAT_PAGE,
  type StatChunk,
  type StatStore,
  type StoredChunk,
} from "./stats.ts";

const SECRET = "correct horse battery staple";

const ORIGIN = "http://localhost";

const memory = (): StatStore => {
  const chunks = new Map<number, StoredChunk>();

  return {
    read: async (_membershipId, after, limit) =>
      [...chunks.values()]
        .filter((chunk) => isAfter(chunk, after))
        .sort((a, b) => a.updatedAt - b.updatedAt || a.startsAt - b.startsAt)
        .slice(0, limit),
    write: async (_membershipId, chunk, now) => {
      const existing = chunks.get(chunk.startsAt);

      if (existing && existing.length > chunk.length) {
        return;
      }

      chunks.set(chunk.startsAt, { ...chunk, updatedAt: now });
    },
  };
};

const service = () =>
  createHandler({
    apiKey: "",
    clientId: "",
    clientSecret: "",
    sessionSecret: SECRET,
    allowedOrigin: ORIGIN,
    authOrigin: ORIGIN,
    loader: { index: async () => undefined, raw: async () => undefined },
    tags: {
      read: async () => ({ defs: [], items: [] }),
      write: async () => undefined,
    },
    notes: { read: async () => [], write: async () => undefined },
    stats: memory(),
  });

const bearer = async () =>
  `Bearer ${await mintSession(SECRET, "m", Date.now() + 60_000)}`;

const post = async (
  handle: ReturnType<typeof service>,
  startsAt: number,
  changes: unknown[],
) =>
  handle(
    new Request(`${ORIGIN}/stats`, {
      method: "POST",
      headers: { Authorization: await bearer() },
      body: JSON.stringify({
        startsAt,
        endsAt: startsAt + STAT_BUCKET,
        body: JSON.stringify(changes),
      }),
    }),
  );

const pull = async (
  handle: ReturnType<typeof service>,
  since: number,
  after: number,
) =>
  (await (
    await handle(
      new Request(`${ORIGIN}/stats?since=${since}&after=${after}`, {
        headers: { Authorization: await bearer() },
      }),
    )
  ).json()) as { chunks: StatChunk[]; more: boolean };

describe("stat chunks", () => {
  it("keeps the longer copy of a bucket through gzip", async () => {
    const handle = service();
    const long = [{ kind: "currency" }, { kind: "currency" }];

    await post(handle, 0, long);
    await post(handle, 0, [{ kind: "currency" }]);

    const { chunks } = await pull(handle, 0, 0);

    expect(chunks.map((chunk) => JSON.parse(chunk.body))).toEqual([long]);
  });

  it("pages from the last chunk handed out", async () => {
    const handle = service();

    for (let index = 0; index <= STAT_PAGE; index++) {
      await post(handle, index * STAT_BUCKET, [{ kind: "currency" }]);
    }

    const first = await pull(handle, 0, 0);
    const last = first.chunks.at(-1)!;
    const second = await pull(handle, last.updatedAt, last.startsAt);

    expect(first.chunks).toHaveLength(STAT_PAGE);
    expect(first.more).toBe(true);
    expect(second.chunks.map((chunk) => chunk.startsAt)).toEqual([
      STAT_PAGE * STAT_BUCKET,
    ]);
    expect(second.more).toBe(false);
  });
});
