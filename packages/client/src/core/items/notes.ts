import { createSignal } from "solid-js";

import type { Note, NoteKind } from "@dvm/service";

import { callService } from "../api/auth.ts";
import { readStored, writeStored } from "../storage.ts";
import { mergeNewer } from "./sync.ts";

const KEY = "dvm.notes";

const ENDPOINT = "/api/notes";

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
  const parsed = readStored(KEY) as Partial<Held> | undefined;

  if (!parsed) {
    return EMPTY;
  }

  return {
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    since: typeof parsed.since === "number" ? parsed.since : 0,
  };
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
    writeStored(KEY, held);
  } catch {
    // Quota or private mode, server still has it
  }
};

const merge = (incoming: Note[]): Note[] =>
  mergeNewer(held.notes, incoming, (note) => noteKey(note.kind, note.targetId));

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
