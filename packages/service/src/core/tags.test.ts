import { describe, expect, it } from "vitest";

import { createHandler } from "./handler.ts";
import { mintSession } from "./session.ts";
import { parseWrite, type ItemTag, type TagDef, type TagStore } from "./tags.ts";

const SECRET = "correct horse battery staple";

const ORIGIN = "http://localhost";

const memory = (): TagStore => {
  const defs = new Map<string, TagDef[]>();
  const items = new Map<string, ItemTag[]>();

  return {
    read: async (membershipId, since) => ({
      defs: (defs.get(membershipId) ?? []).filter(
        (def) => def.updatedAt > since,
      ),
      items: (items.get(membershipId) ?? []).filter(
        (item) => item.updatedAt > since,
      ),
    }),
    write: async (membershipId, changes, now) => {
      defs.set(membershipId, [
        ...(defs.get(membershipId) ?? []),
        ...changes.defs.map((def) => ({ ...def, updatedAt: now })),
      ]);
      items.set(membershipId, [
        ...(items.get(membershipId) ?? []),
        ...changes.items.map((item) => ({ ...item, updatedAt: now })),
      ]);
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
    tags: memory(),
  });

const bearer = async (membershipId: string) =>
  `Bearer ${await mintSession(SECRET, membershipId, Date.now() + 60_000)}`;

const ITEM = {
  instanceId: "6917529",
  itemHash: 1234,
  tagId: "keep",
  removed: false,
};

describe("tag changes", () => {
  it("rejects a batch with a malformed entry", () => {
    expect(parseWrite({ items: [ITEM] })).toEqual({ defs: [], items: [ITEM] });
    expect(parseWrite({ items: [{ ...ITEM, itemHash: "1234" }] })).toBeUndefined();
    expect(parseWrite({ items: [{ ...ITEM, instanceId: "" }] })).toBeUndefined();
  });
});

describe("tag access", () => {
  it("refuses a request with no session", async () => {
    const response = await service()(
      new Request(`${ORIGIN}/tags`, { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });

  it("refuses a session signed with another secret", async () => {
    const token = await mintSession("guessed", "alice", Date.now() + 60_000);

    const response = await service()(
      new Request(`${ORIGIN}/tags`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(401);
  });

  // The membership comes from the signature, never from the request
  it("never returns rows belonging to another membership", async () => {
    const handler = service();

    await handler(
      new Request(`${ORIGIN}/tags`, {
        method: "POST",
        headers: { Authorization: await bearer("alice") },
        body: JSON.stringify({ items: [ITEM] }),
      }),
    );

    const mine = await handler(
      new Request(`${ORIGIN}/tags`, {
        headers: { Authorization: await bearer("alice") },
      }),
    );

    const theirs = await handler(
      new Request(`${ORIGIN}/tags`, {
        headers: { Authorization: await bearer("bob") },
      }),
    );

    expect(((await mine.json()) as { items: ItemTag[] }).items).toHaveLength(1);
    expect(((await theirs.json()) as { items: ItemTag[] }).items).toEqual([]);
  });
});
