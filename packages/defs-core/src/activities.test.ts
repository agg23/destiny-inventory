import type { DestinyActivityDifficultyTierCollectionDefinition } from "bungie-api-ts/destiny2";
import { describe, expect, it } from "vitest";

import { activityName, difficultyOf, slimDifficulty } from "./activities.ts";

describe("difficultyOf", () => {
  it("reads every rung of the ladder", () => {
    expect(difficultyOf("Vault of Glass: Standard")).toBe("Standard");
    expect(difficultyOf("Nightfall: Savathûn's Song: Normal")).toBe("Normal");
    expect(difficultyOf("Nightfall: The Ordeal: Adept")).toBe("Adept");
    expect(difficultyOf("Nightfall: The Ordeal: Hero")).toBe("Hero");
    expect(difficultyOf("The Arms Dealer: Advanced")).toBe("Advanced");
    expect(difficultyOf("Expert Conquest: Sunless Cell")).toBe("Expert");
    expect(difficultyOf("Nightfall: The Ordeal: Legend")).toBe("Legend");
    expect(difficultyOf("QUEST: The Arms Dealer: Prestige")).toBe("Prestige");
    expect(difficultyOf("Master Conquest: Derealize")).toBe("Master");
    expect(difficultyOf("Nightfall Grandmaster: Broodhold")).toBe(
      "Grandmaster",
    );
    expect(difficultyOf("Ultimate Conquest: Lightblade")).toBe("Ultimate");
  });

  // The only two names in the manifest that claim two rungs
  it("takes the harder rung when a name claims two", () => {
    expect(difficultyOf("Salvage Legend: Master")).toBe("Master");
    expect(
      difficultyOf("Nightfall Grandmaster: Legend PsiOps Battleground"),
    ).toBe("Grandmaster");
  });

  it("does not read Grandmaster as Master", () => {
    expect(difficultyOf("The Ordeal: Grandmaster")).toBe("Grandmaster");
  });

  it("counts a parenthesized Heroic but not a Heroic in the name", () => {
    expect(difficultyOf("The Whisper (Heroic)")).toBe("Hero");
    expect(difficultyOf("K1 Communion (Legendary)")).toBe("Legend");
    expect(difficultyOf("Heroic Strikes Playlist")).toBeUndefined();
    expect(
      difficultyOf(
        "Guardian Games: Recreational Playlist: Standard Matchmaking",
      ),
    ).toBeUndefined();
    expect(difficultyOf("Daily Heroic Story Mission: Hope")).toBeUndefined();
  });

  it("has no rung for an activity that offers no choice", () => {
    expect(difficultyOf("Lake of Shadows")).toBeUndefined();
    expect(difficultyOf("Red Legion, Black Oil")).toBeUndefined();
  });
});

describe("activityName", () => {
  it("drops a rung that owns a segment", () => {
    expect(activityName("Nightfall: The Ordeal: Legend")).toBe(
      "Nightfall: The Ordeal",
    );
    expect(activityName("Nightfall: Master")).toBe("Nightfall");
    expect(activityName("Vault of Glass: Standard")).toBe("Vault of Glass");
    expect(activityName("The Ordeal: Grandmaster: The Festering Core")).toBe(
      "The Ordeal: The Festering Core",
    );
  });

  it("drops the Portal's launch mode", () => {
    expect(activityName("The Dark Priestess: Customize")).toBe(
      "The Dark Priestess",
    );
    expect(activityName("Master Conquest: Derealize: Customize")).toBe(
      "Master Conquest: Derealize",
    );
  });

  it("drops a trailing parenthetical rung", () => {
    expect(activityName("K1 Communion (Legendary)")).toBe("K1 Communion");
    expect(activityName("The Whisper (Heroic)")).toBe("The Whisper");
    expect(activityName("Kell's Fall: Distortion (Expert)")).toBe(
      "Kell's Fall: Distortion",
    );
  });

  // Cutting inside a segment would leave "Conquest" and "Nightfall Grandmaster"
  it("leaves a rung that shares its segment with other words", () => {
    expect(activityName("Nightfall Grandmaster: The Corrupted")).toBe(
      "Nightfall Grandmaster: The Corrupted",
    );
    expect(activityName("Heroic Strikes Playlist")).toBe(
      "Heroic Strikes Playlist",
    );
  });

  it("keeps a parenthetical that is not a rung", () => {
    expect(activityName("The Nether: Advanced - Private")).toBe(
      "The Nether: Advanced - Private",
    );
    expect(activityName("Vault of Glass (Level 26)")).toBe(
      "Vault of Glass (Level 26)",
    );
  });

  it("keeps the name when the rung is all there is", () => {
    expect(activityName("Master")).toBe("Master");
  });
});

const tier = (
  name: string,
  tierRank: number,
  tierType = 0,
): Record<string, unknown> => ({
  displayProperties: { name },
  tierRank,
  tierType,
  activityLevel: 30,
  minimumFireteamLeaderPower: 0,
});

describe("slimDifficulty", () => {
  // A report's activityDifficultyTier indexes Bungie's unsorted list
  it("keeps the raw index across the training filter and the rank sort", () => {
    const slim = slimDifficulty({
      hash: 7,
      difficultyTiers: [
        tier("Training (1 of 2)", 0, 1),
        tier("Training (2 of 2)", 0, 1),
        tier("Master", 40),
        tier("", 5),
        tier("Normal", 10),
      ],
    } as unknown as DestinyActivityDifficultyTierCollectionDefinition);

    expect(slim.tiers.map((one) => [one.name, one.index])).toEqual([
      ["Normal", 4],
      ["Master", 2],
    ]);
  });
});
