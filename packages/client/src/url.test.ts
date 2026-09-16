import { describe, expect, it } from "vitest";

import { setGuest } from "./guest.ts";
import {
  activityHref,
  activityLabel,
  readParam,
  runHref,
  tabHref,
  writeParams,
} from "./url.ts";

describe("reading params", () => {
  it("falls back when a param is absent", () => {
    expect(readParam("range", undefined)).toBe("30d");
    expect(readParam("q", undefined)).toBe("");
    expect(readParam("view", undefined)).toBe("recent");
    expect(readParam("rest", undefined)).toBe(false);
    expect(readParam("pin", undefined)).toEqual([]);
  });

  it("falls back when a choice is not one of the allowed", () => {
    expect(readParam("view", "sideways")).toBe("recent");
  });

  it("reads a list", () => {
    expect(readParam("pin", "123_456")).toEqual(["123", "456"]);
  });

  it("reads a flag only when it is set", () => {
    expect(readParam("rest", "1")).toBe(true);
    expect(readParam("rest", "0")).toBe(false);
  });

  it("ignores a count that is not a number", () => {
    expect(readParam("days", "soon")).toBeUndefined();
    expect(readParam("days", "7")).toBe(7);
  });

  it("treats an empty string as absent", () => {
    expect(readParam("character", "")).toBeUndefined();
  });
});

describe("writing params", () => {
  it("drops a default so the tidy URL stays tidy", () => {
    expect(writeParams({ range: "30d", view: "recent", q: "" })).toEqual({
      range: undefined,
      view: undefined,
      q: undefined,
    });
  });

  it("keeps a value that is not the default", () => {
    expect(writeParams({ range: "all", view: "map" })).toEqual({
      range: "all",
      view: "map",
    });
  });

  it("writes a flag as one, or drops it", () => {
    expect(writeParams({ rest: true })).toEqual({ rest: "1" });
    expect(writeParams({ rest: false })).toEqual({ rest: undefined });
  });

  it("joins with a separator the query string leaves alone", () => {
    const written = writeParams({ pin: ["1", "2"] });

    expect(
      new URLSearchParams(written as Record<string, string>).toString(),
    ).toBe("pin=1_2");
  });

  it("joins a list and drops an empty one", () => {
    expect(writeParams({ pin: ["1", "2"] })).toEqual({ pin: "1_2" });
    expect(writeParams({ pin: [] })).toEqual({ pin: undefined });
  });

  it("touches only the keys it is given", () => {
    expect(Object.keys(writeParams({ run: "9" }))).toEqual(["run"]);
  });

  it("survives a round trip", () => {
    const written = writeParams({ pin: ["1", "2"], days: 7, rest: true });

    expect(readParam("pin", written.pin)).toEqual(["1", "2"]);
    expect(readParam("days", written.days)).toBe(7);
    expect(readParam("rest", written.rest)).toBe(true);
  });
});

describe("hrefs", () => {
  it("leaves the filter behind on a tab change", () => {
    expect(tabHref("history")).toBe("/history");
  });

  it("escapes a label that would otherwise split the path", () => {
    expect(activityHref("A/B", undefined)).toBe("/history/activity/A%2FB");
  });

  it("carries the rung that names the activity with its label", () => {
    expect(activityHref("Grasp of Avarice", "Master")).toBe(
      "/history/activity/Grasp%20of%20Avarice?rung=Master",
    );
  });

  it("keeps the guest on every path it builds", () => {
    setGuest({ membershipType: 3, membershipId: "4611686018468466126" });

    expect(tabHref("history")).toBe("/history?guest=3_4611686018468466126");
    expect(activityHref("Grasp of Avarice", "Master")).toBe(
      "/history/activity/Grasp%20of%20Avarice?rung=Master&guest=3_4611686018468466126",
    );
    expect(runHref("Grasp of Avarice", undefined, "17")).toBe(
      "/history/activity/Grasp%20of%20Avarice?guest=3_4611686018468466126&run=17",
    );

    setGuest(undefined);
  });
});

describe("activity labels", () => {
  it("decodes what the router leaves encoded", () => {
    expect(activityLabel("Grasp%20of%20Avarice")).toBe("Grasp of Avarice");
  });

  it("survives the href it was built from", () => {
    const href = activityHref("Warlord's Ruin", undefined);
    const [, , , segment] = href.split("/");

    expect(activityLabel(segment)).toBe("Warlord's Ruin");
  });

  it("keeps a malformed escape rather than throwing", () => {
    expect(activityLabel("100%")).toBe("100%");
  });
});
