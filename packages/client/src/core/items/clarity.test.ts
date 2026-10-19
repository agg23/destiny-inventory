import { describe, expect, it } from "vitest";

import { parseClarity, parseLine } from "./clarity.ts";

const ARROW = { text: "🡅", classNames: ["enhancedArrow"] };

describe("clarity", () => {
  it("brightens numbers in plain text", () => {
    expect(
      parseLine({
        linesContent: [{ text: "Grants 25% damage for 5 seconds." }],
      }).spans,
    ).toEqual([
      { kind: "text", text: "Grants ", tones: [] },
      { kind: "number", text: "25%" },
      { kind: "text", text: " damage for ", tones: [] },
      { kind: "number", text: "5" },
      { kind: "text", text: " seconds.", tones: [] },
    ]);
  });

  it("labels the PvP value and leaves the PvE one plain", () => {
    expect(
      parseLine({
        linesContent: [
          { text: "100%", classNames: ["pve"] },
          { text: " " },
          { text: "[50%]", classNames: ["pvp"] },
        ],
      }).spans,
    ).toEqual([
      { kind: "number", text: "100%" },
      { kind: "text", text: " ", tones: [] },
      { kind: "text", text: "[PvP 50%]", tones: ["pvp"] },
    ]);
  });

  it("shows Clarity's category colors as named items", () => {
    expect(
      parseLine({
        linesContent: [
          { text: "Blighted by " },
          { text: "Witherhoard", classNames: ["yellow"] },
        ],
      }).spans,
    ).toEqual([
      { kind: "text", text: "Blighted by ", tones: [] },
      { kind: "text", text: "Witherhoard", tones: ["named"] },
    ]);
  });

  it("applies line tones to every span", () => {
    expect(
      parseLine({
        classNames: ["yellow", "bold"],
        linesContent: [{ text: "Note" }],
      }).spans,
    ).toEqual([{ kind: "text", text: "Note", tones: ["named", "bold"] }]);
  });

  it("splits pipes out of stack lists", () => {
    expect(
      parseLine({ linesContent: [{ text: "1|2 | 3 Stacks" }] }).spans,
    ).toEqual([
      { kind: "number", text: "1" },
      { kind: "pipe" },
      { kind: "number", text: "2" },
      { kind: "pipe" },
      { kind: "number", text: "3" },
      { kind: "text", text: " Stacks", tones: [] },
    ]);
  });

  it("takes the bullet off a bullet line", () => {
    expect(
      parseLine({ linesContent: [{ text: "• Refills " }, { text: "10%" }] }),
    ).toEqual({
      bullet: true,
      spans: [
        { kind: "text", text: "Refills ", tones: [] },
        { kind: "number", text: "10%" },
      ],
    });
  });

  it("reads a blank line from a spacer", () => {
    expect(parseLine({ classNames: ["spacer"] })).toEqual({
      bullet: false,
      spans: [],
    });
  });

  it("marks the number after an arrow", () => {
    expect(
      parseLine({
        linesContent: [
          { text: "Grants 25% increased damage for " },
          ARROW,
          { text: "5.5 seconds." },
        ],
      }).spans,
    ).toEqual([
      { kind: "text", text: "Grants ", tones: [] },
      { kind: "number", text: "25%" },
      { kind: "text", text: " increased damage for ", tones: [] },
      { kind: "enhanced", text: "5.5" },
      { kind: "text", text: " seconds.", tones: [] },
    ]);
  });

  it("marks the rest of the line when no number follows the arrow", () => {
    expect(
      parseLine({
        linesContent: [ARROW, { text: " Increases Sticky Bomb damage." }],
      }).spans,
    ).toEqual([{ kind: "enhanced", text: "Increases Sticky Bomb damage." }]);
  });

  // Collective Action writes the arrow inside the value
  it("marks an arrow inside a toned span", () => {
    expect(
      parseLine({
        linesContent: [
          { text: "🡅33%", classNames: ["pve"] },
          { text: " " },
          { text: "[🡅11%]", classNames: ["pvp"] },
        ],
      }).spans,
    ).toEqual([
      { kind: "enhanced", text: "33%" },
      { kind: "text", text: " ", tones: [] },
      { kind: "text", text: "[PvP ", tones: ["pvp"] },
      { kind: "enhanced", text: "11%" },
      { kind: "text", text: "]", tones: ["pvp"] },
    ]);
  });

  it("skips past text and icons to the next number", () => {
    expect(
      parseLine({
        linesContent: [
          ARROW,
          { text: " Having " },
          { classNames: ["solar"] },
          { text: "Ember of Ashes adds 5 Stacks." },
        ],
      }).spans,
    ).toEqual([
      { kind: "text", text: "Having ", tones: [] },
      { kind: "icon", icon: "solar" },
      { kind: "text", text: "Ember of Ashes adds ", tones: [] },
      { kind: "enhanced", text: "5" },
      { kind: "text", text: " Stacks.", tones: [] },
    ]);
  });

  it("swaps glyphs with no macOS font", () => {
    expect(
      parseLine({ linesContent: [{ text: "▛ Seeker ▟ kill ⇒ stack, 50🠚55" }] })
        .spans,
    ).toEqual([
      { kind: "text", text: "“Seeker” kill → stack, ", tones: [] },
      { kind: "number", text: "50" },
      { kind: "text", text: "→", tones: [] },
      { kind: "number", text: "55" },
    ]);
  });

  it("drops perks without English text", () => {
    const parsed = parseClarity({
      "1": { descriptions: null },
      "2": { descriptions: { en: [{ linesContent: [{ text: "Text" }] }] } },
    });

    expect([...parsed.keys()]).toEqual([2]);
  });
});
