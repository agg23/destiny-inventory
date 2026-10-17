import { createSignal } from "solid-js";

import type { Note, NoteKind } from "@dvm/service";

import { callService } from "../api/auth.ts";

const KEY = "dvm.notes";

const ENDPOINT = "/api/notes";

// Matches the service's cap
export const MAX_NOTE_LENGTH = 2_000;

interface Held {
  notes: Note[];
  since: number;
}

export interface NoteTarget {
  kind: NoteKind;
  targetId: string;
  itemHash?: number;
}

const EMPTY: Held = { notes: [], since: 0 };

const noteKey = (kind: NoteKind, targetId: string): string =>
  `${kind}/${targetId}`;

const restore = (): Held => {
  const raw = localStorage.getItem(KEY);

  if (raw === null) {
    return EMPTY;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Held>;

    return {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      since: typeof parsed.since === "number" ? parsed.since : 0,
    };
  } catch {
    return EMPTY;
  }
};

let held: Held = restore();

const [bodies, setBodies] = createSignal<ReadonlyMap<string, string>>(
  new Map(),
);

const publish = () =>
  setBodies(
    new Map(
      held.notes.flatMap((note) =>
        note.removed
          ? []
          : [[noteKey(note.kind, note.targetId), note.body] as const],
      ),
    ),
  );

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(held));
  } catch {
    // Quota or private mode, and the server still holds it
  }
};

const merge = (incoming: Note[]): Note[] => {
  const map = new Map(
    held.notes.map((note) => [noteKey(note.kind, note.targetId), note]),
  );

  for (const note of incoming) {
    const key = noteKey(note.kind, note.targetId);
    const existing = map.get(key);

    if (!existing || note.updatedAt >= existing.updatedAt) {
      map.set(key, note);
    }
  }

  return [...map.values()];
};

/** Pulls everything newer than the last sync, removals included */
export const syncNotes = async (): Promise<void> => {
  const response = await callService(`${ENDPOINT}?since=${held.since}`);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json()) as { notes: Note[]; now: number };

  held = { notes: merge(body.notes), since: body.now };

  save();
  publish();
};

export const noteFor = (target: NoteTarget): string | undefined =>
  bodies().get(noteKey(target.kind, target.targetId));

/** Saves or clears one note. False when the service did not take it */
export const saveNote = async (
  target: NoteTarget,
  body: string,
): Promise<boolean> => {
  const removed = body.trim().length === 0;
  const change = {
    kind: target.kind,
    targetId: target.targetId,
    itemHash: target.kind === "instance" ? target.itemHash : undefined,
    body: removed ? "" : body,
    removed,
  };

  const response = await callService(ENDPOINT, {
    method: "POST",
    body: JSON.stringify(change),
  });

  if (!response?.ok) {
    return false;
  }

  const { now } = (await response.json()) as { now: number };

  held = { ...held, notes: merge([{ ...change, updatedAt: now }]) };

  save();
  publish();

  return true;
};

publish();
