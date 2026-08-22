import { beforeEach, describe, expect, it } from "vitest";

import { forgetSearch, recentSearches, rememberSearch } from "./searches.ts";

const store = new Map<string, string>();

globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

describe("rememberSearch", () => {
  beforeEach(() => store.clear());

  it("keeps the newest first", () => {
    rememberSearch("is:weapon");
    rememberSearch("is:armor");

    expect(recentSearches()).toEqual(["is:armor", "is:weapon"]);
  });

  it("moves a repeat to the front instead of duplicating it", () => {
    rememberSearch("is:weapon");
    rememberSearch("is:armor");

    expect(rememberSearch("is:weapon")).toEqual(["is:weapon", "is:armor"]);
  });

  it("caps the list", () => {
    for (let index = 0; index < 25; index += 1) {
      rememberSearch(`power:>${index}`);
    }

    expect(recentSearches().length).toBe(20);
  });

  it("ignores an empty query", () => {
    expect(rememberSearch("   ")).toEqual([]);
  });

  it("survives junk in storage", () => {
    store.set("dvm.searches", "{oh no");

    expect(recentSearches()).toEqual([]);
  });

  it("forgets one entry", () => {
    rememberSearch("is:weapon");
    rememberSearch("is:armor");

    expect(forgetSearch("is:weapon")).toEqual(["is:armor"]);
  });
});
