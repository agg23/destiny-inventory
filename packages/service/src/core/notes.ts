// Rows are never deleted. A removal is the flag plus a fresh timestamp

export const NOTE_KINDS = ["instance", "item", "set"] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

export const MAX_NOTE_LENGTH = 2_000;

export interface Note {
  kind: NoteKind;
  /** Instance id, Collections entry key, or Collections set key */
  targetId: string;
  /** Only recorded for instances */
  itemHash: number | undefined;
  body: string;
  removed: boolean;
  updatedAt: number;
}

export type NoteChange = Omit<Note, "updatedAt">;

export interface NoteStore {
  read: (membershipId: string, since: number) => Promise<Note[]>;
  write: (membershipId: string, change: NoteChange, now: number) => Promise<void>;
}

/** Undefined when the body is not one well formed note */
export const parseNote = (raw: unknown): NoteChange | undefined => {
  const { kind, targetId, itemHash, body, removed } = (raw ?? {}) as Record<
    string,
    unknown
  >;

  const cleanKind = NOTE_KINDS.find((one) => one === kind);

  if (
    cleanKind === undefined ||
    typeof targetId !== "string" ||
    targetId.length === 0 ||
    targetId.length > 200 ||
    typeof body !== "string" ||
    body.length > MAX_NOTE_LENGTH
  ) {
    return undefined;
  }

  // DIM gives every non-instanced item the id 0
  if (
    cleanKind === "instance" &&
    (targetId === "0" ||
      typeof itemHash !== "number" ||
      !Number.isSafeInteger(itemHash))
  ) {
    return undefined;
  }

  const cleanRemoved = !!removed || body.trim().length === 0;

  return {
    kind: cleanKind,
    targetId,
    itemHash: cleanKind === "instance" ? (itemHash as number) : undefined,
    body: cleanRemoved ? "" : body,
    removed: cleanRemoved,
  };
};
