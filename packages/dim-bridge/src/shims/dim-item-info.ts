// The real module carries hotkeys and icons for the tag UI, which drags the icon set in.
// The move layer only reads the orderings, and their exact order decides what gets displaced
export type TagValue = "favorite" | "keep" | "junk" | "infuse" | "archive";

export type TagCommand = TagValue | "clear";

export const characterDisplacePriority: (TagValue | "none")[] = [
  "archive",
  "infuse",
  "none",
  "junk",
  "keep",
  "favorite",
];

export const vaultDisplacePriority: (TagValue | "none")[] = [
  "junk",
  "none",
  "keep",
  "favorite",
  "infuse",
  "archive",
];

export const equipReplacePriority: (TagValue | "none")[] = [
  "favorite",
  "keep",
  "none",
  "infuse",
  "junk",
  "archive",
];
