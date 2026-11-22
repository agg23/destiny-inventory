import { createSignal } from "solid-js";

import type { Look, LookChange } from "@dvm/service";

import { callService } from "../api/auth.ts";
import { mergeNewer } from "../items/sync.ts";
import { readStored, writeStored } from "../storage.ts";

const KEY = "dvm.looks";

const ENDPOINT = "/api/looks";

interface Held {
  looks: Look[];
  since: number;
}

const EMPTY: Held = { looks: [], since: 0 };

const restore = (): Held => {
  const parsed = readStored(KEY) as Partial<Held> | undefined;

  if (!parsed) {
    return EMPTY;
  }

  return {
    looks: Array.isArray(parsed.looks) ? parsed.looks : [],
    since: typeof parsed.since === "number" ? parsed.since : 0,
  };
};

let held: Held = restore();

const [shown, setShown] = createSignal<Look[]>([]);

const publish = () =>
  setShown(
    held.looks
      .filter((look) => !look.removed)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

const save = () => {
  try {
    writeStored(KEY, held);
  } catch {
    // Quota or private mode, server still has it
  }
};

const merge = (incoming: Look[]): Look[] =>
  mergeNewer(held.looks, incoming, (look) => look.id);

export const savedLooks = shown;

/** Pulls everything newer than the last sync, removals included */
export const syncLooks = async (): Promise<void> => {
  const response = await callService(`${ENDPOINT}?since=${held.since}`);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json()) as { looks: Look[]; now: number };

  held = { looks: merge(body.looks), since: body.now };

  save();
  publish();
};

/** Saves, renames, or removes one look. False when the service did not take it */
export const writeLook = async (change: LookChange): Promise<boolean> => {
  const response = await callService(ENDPOINT, {
    method: "POST",
    body: JSON.stringify(change),
  });

  if (!response?.ok) {
    return false;
  }

  const { now } = (await response.json()) as { now: number };

  held = { ...held, looks: merge([{ ...change, updatedAt: now }]) };

  save();
  publish();

  return true;
};

publish();
