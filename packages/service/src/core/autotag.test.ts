import { describe, expect, it } from "vitest";

import { parseRules, parseStateChange } from "./autotag.ts";

const LOW = "00006917529000000001";

const HIGH = "00006917529000000002";

const RULE = {
  id: "a",
  query: "is:handcannon",
  tagId: "junk",
  vault: true,
  enabled: true,
  position: 0,
  removed: false,
};

describe("autotag changes", () => {
  it("rejects a batch with a malformed rule", () => {
    expect(parseRules({ rules: [RULE] })).toEqual([RULE]);
    expect(parseRules({ rules: [{ ...RULE, tagId: undefined }] })).toEqual([
      { ...RULE, tagId: undefined },
    ]);
    expect(
      parseRules({ rules: [RULE, { ...RULE, query: "" }] }),
    ).toBeUndefined();
    expect(parseRules({ rules: [{ ...RULE, tagId: 3 }] })).toBeUndefined();
  });

  it("only claims forward over padded marks", () => {
    expect(parseStateChange({ kind: "claim", from: LOW, to: HIGH })).toEqual({
      kind: "claim",
      from: LOW,
      to: HIGH,
    });
    expect(
      parseStateChange({ kind: "claim", from: HIGH, to: LOW }),
    ).toBeUndefined();
    expect(
      parseStateChange({ kind: "enable", mark: "6917529000000001" }),
    ).toBeUndefined();
  });
});
