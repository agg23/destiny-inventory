import { describe, expect, it } from "vitest";

import { createHandler } from "./handler.ts";
import { MAX_NOTE_LENGTH, parseNote, type Note, type NoteStore } from "./notes.ts";
import { mintSession } from "./session.ts";

const SECRET = "correct horse battery staple";

const ORIGIN = "http://localhost";

const memory = (): NoteStore => {
  const notes = new Map<string, Map<string, Note>>();

  return {
    read: async (membershipId, since) =>
      [...(notes.get(membershipId)?.values() ?? [])].filter(
        (note) => note.updatedAt > since,
      ),
    write: async (membershipId, change, now) => {
      const held = notes.get(membershipId) ?? new Map<string, Note>();
      held.set(`${change.kind}/${change.targetId}`, {
        ...change,
        updatedAt: now,
      });
      notes.set(membershipId, held);
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
    notes: memory(),
  });

const bearer = async (membershipId: string) =>
  `Bearer ${await mintSession(SECRET, membershipId, Date.now() + 60_000)}`;

const INSTANCE = {
  kind: "instance",
  targetId: "6917529",
  itemHash: 1234,
  body: "Keep for Grandmasters",
  removed: false,
};

const SET = {
  kind: "set",
  targetId: "2|Collective Psyche",
  body: "Farm the 4pc",
  removed: false,
};

describe("note changes", () => {
  it("rejects a malformed note", () => {
    expect(parseNote({ ...INSTANCE, kind: "loadout" })).toBeUndefined();
    expect(parseNote({ ...INSTANCE, targetId: "0" })).toBeUndefined();
    expect(parseNote({ ...INSTANCE, itemHash: undefined })).toBeUndefined();
    expect(
      parseNote({ ...SET, body: "x".repeat(MAX_NOTE_LENGTH + 1) }),
    ).toBeUndefined();
  });

  it("drops the item hash from anything but an instance", () => {
    expect(parseNote({ ...SET, itemHash: 1234 })?.itemHash).toBeUndefined();
    expect(parseNote(INSTANCE)?.itemHash).toBe(1234);
  });

  it("treats a blank note as a removal", () => {
    expect(parseNote({ ...SET, body: "  \n" })).toMatchObject({
      body: "",
      removed: true,
    });
    expect(parseNote({ ...SET, removed: true })).toMatchObject({
      body: "",
      removed: true,
    });
  });
});

describe("note access", () => {
  it("refuses a request with no session", async () => {
    const response = await service()(
      new Request(`${ORIGIN}/notes`, { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });

  it("never returns notes belonging to another membership", async () => {
    const handler = service();

    await handler(
      new Request(`${ORIGIN}/notes`, {
        method: "POST",
        headers: { Authorization: await bearer("alice") },
        body: JSON.stringify(SET),
      }),
    );

    const mine = await handler(
      new Request(`${ORIGIN}/notes`, {
        headers: { Authorization: await bearer("alice") },
      }),
    );
    const theirs = await handler(
      new Request(`${ORIGIN}/notes`, {
        headers: { Authorization: await bearer("bob") },
      }),
    );

    expect(((await mine.json()) as { notes: Note[] }).notes).toHaveLength(1);
    expect(((await theirs.json()) as { notes: Note[] }).notes).toEqual([]);
  });
});
