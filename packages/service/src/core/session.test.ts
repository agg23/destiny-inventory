import { describe, expect, it } from "vitest";

import { mintSession, readSession } from "./session.ts";

const SECRET = "correct horse battery staple";

const NOW = Date.parse("2026-09-17T12:00:00Z");

const LATER = NOW + 60_000;

describe("session tokens", () => {
  it("round trips the membership that signed in", async () => {
    const token = await mintSession(SECRET, "4611686018468466126", LATER);

    expect(await readSession(SECRET, token, NOW)).toEqual({
      membershipId: "4611686018468466126",
      expires: LATER,
    });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await mintSession("guessed", "4611686018468466126", LATER);

    expect(await readSession(SECRET, token, NOW)).toBeUndefined();
  });

  it("rejects a tampered payload", async () => {
    const token = await mintSession(SECRET, "4611686018468466126", LATER);
    const [, signature] = token.split(".");
    const forged = btoa(
      JSON.stringify({ membershipId: "1", expires: LATER }),
    ).replaceAll("=", "");

    expect(
      await readSession(SECRET, `${forged}.${signature}`, NOW),
    ).toBeUndefined();
  });

  it("rejects an expired token", async () => {
    const token = await mintSession(SECRET, "4611686018468466126", NOW);

    expect(await readSession(SECRET, token, LATER)).toBeUndefined();
  });

  it("rejects malformed tokens rather than throwing", async () => {
    expect(await readSession(SECRET, "", NOW)).toBeUndefined();
    expect(await readSession(SECRET, "nodot", NOW)).toBeUndefined();
    expect(await readSession(SECRET, "!!!.@@@", NOW)).toBeUndefined();
  });
});
