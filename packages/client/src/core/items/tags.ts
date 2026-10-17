import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import type { ItemTag, TagDef } from "@dvm/service";

import { callService } from "../api/auth.ts";
import { readStored, writeStored } from "../storage.ts";
import { mergeNewer } from "./sync.ts";

const KEY = "dvm.tags";

const ENDPOINT = "/api/tags";

const FLUSH_MS = 500;

interface Held {
  defs: TagDef[];
  items: ItemTag[];
  since: number;
}

export interface TagTarget {
  instanceId: string;
  itemHash: number;
}

export interface TagSnapshot extends TagTarget {
  tagId: string | undefined;
}

const PROTECTED = new Set(["favorite", "keep", "pvp", "pve"]);

const EMPTY: Held = { defs: [], items: [], since: 0 };

// Colors from tokens.css
const DEFAULT_DEFS: TagDef[] = (
  [
    ["favorite", "Favorite", "exotic"],
    ["keep", "Keep", "good"],
    ["pvp", "PvP", "pvp"],
    ["pve", "PvE", "pve"],
    ["junk", "Junk", "error"],
    ["infuse", "Infuse", "arc"],
    ["archive", "Archive", "void"],
  ] as const
).map(([id, label, color], position) => ({
  id,
  label,
  color,
  position,
  removed: false,
  updatedAt: 0,
}));

const itemKey = (item: ItemTag): string => `${item.instanceId}/${item.tagId}`;

const restore = (): Held => {
  const parsed = readStored(KEY) as Partial<Held> | undefined;

  if (!parsed) {
    return EMPTY;
  }

  return {
    defs: Array.isArray(parsed.defs) ? parsed.defs : [],
    items: Array.isArray(parsed.items) ? parsed.items : [],
    since: typeof parsed.since === "number" ? parsed.since : 0,
  };
};

let held: Held = restore();

const [defs, setDefs] = createSignal<TagDef[]>([]);

const [assigned, setAssigned] = createSignal<
  ReadonlyMap<string, ReadonlySet<string>>
>(new Map());

/** Tag definitions in display order */
export const tagDefs = defs;

/** The one tag an item carries. Storage allows several; the UI does not */
export const tagFor = (instanceId: string): TagDef | undefined => {
  const held = assigned().get(instanceId);

  return held ? defs().find((def) => held.has(def.id)) : undefined;
};

const index = (items: ItemTag[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();

  for (const item of items) {
    if (item.removed) {
      continue;
    }

    const existing = map.get(item.instanceId) ?? new Set<string>();

    existing.add(item.tagId);
    map.set(item.instanceId, existing);
  }

  return map;
};

// Stored defs are ignored for now; with no editor the table is only test data
const publishDefs = () => {
  setDefs(
    [...DEFAULT_DEFS].sort((one, two) => one.position - two.position),
  );
};

const publishItems = () => setAssigned(index(held.items));

const save = () => {
  try {
    writeStored(KEY, held);
  } catch {
    // Quota or private mode, server still has it
  }
};

interface Served {
  defs: TagDef[];
  items: ItemTag[];
  now: number;
}

/** Pulls everything newer than the last sync, removals included */
export const syncTags = async (): Promise<void> => {
  const response = await callService(`${ENDPOINT}?since=${held.since}`);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json()) as Served;

  held = {
    defs: mergeNewer(held.defs, body.defs, (def) => def.id),
    items: mergeNewer(held.items, body.items, itemKey),
    since: body.now,
  };

  save();
  publishDefs();
  publishItems();
};

let queued: ItemTag[] = [];
let timer: ReturnType<typeof setTimeout> | undefined = undefined;

const flush = async () => {
  timer = undefined;

  const sending = queued;
  queued = [];

  if (sending.length === 0) {
    return;
  }

  const response = await callService(ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      defs: [],
      items: sending.map((item) => ({
        instanceId: item.instanceId,
        itemHash: item.itemHash,
        tagId: item.tagId,
        removed: item.removed,
      })),
    }),
  });

  // Requeue on failure; the next flush retries
  if (!response?.ok) {
    queued = mergeNewer(sending, queued, itemKey);
  }
};

const queue = (changes: ItemTag[]) => {
  if (changes.length === 0) {
    return;
  }

  held = { ...held, items: mergeNewer(held.items, changes, itemKey) };

  save();
  publishItems();

  queued = mergeNewer(queued, changes, itemKey);

  timer ??= setTimeout(() => void flush(), FLUSH_MS);
};

// /** Creates or updates one tag definition. Rare and deliberate, so it reports a failure */
// export const saveTagDef = async (def: TagDefChange): Promise<boolean> => {
//   const response = await callService(ENDPOINT, {
//     method: "POST",
//     body: JSON.stringify({ defs: [def], items: [] }),
//   });
//
//   if (!response?.ok) {
//     return false;
//   }
//
//   await syncTags();
//
//   return true;
// };

const changesFor = (
  target: TagTarget,
  tagId: string | undefined,
  updatedAt: number,
): ItemTag[] => {
  const { instanceId, itemHash } = target;
  const current = assigned().get(instanceId);

  const cleared = [...(current ?? [])]
    .filter((id) => id !== tagId)
    .map((id) => ({
      instanceId,
      itemHash,
      tagId: id,
      removed: true,
      updatedAt,
    }));

  return tagId === undefined
    ? cleared
    : [...cleared, { instanceId, itemHash, tagId, removed: false, updatedAt }];
};

// DIM gives every non-instanced item the id "0"
const taggable = (target: TagTarget): boolean => target.instanceId !== "0";

/** Sets each item's own tag, flushed as a single write */
export const writeTags = (snapshot: TagSnapshot[]): void => {
  const updatedAt = Date.now();

  queue(
    snapshot
      .filter(taggable)
      .flatMap((one) => changesFor(one, one.tagId, updatedAt)),
  );
};

/** The tag store's handle on an item */
export const tagTarget = (item: DimItem): TagTarget => ({
  instanceId: item.id,
  itemHash: item.hash,
});

/** Sets the tag an item carries, clearing any other. Undefined leaves it untagged */
export const setOnlyTag = (
  instanceId: string,
  itemHash: number,
  tagId: string | undefined,
): void => writeTags([{ instanceId, itemHash, tagId }]);

/** Sets one tag across many items, flushed as a single write */
export const setOnlyTagMany = (
  targets: TagTarget[],
  tagId: string | undefined,
): void => writeTags(targets.map((target) => ({ ...target, tagId })));

export interface TagSummary {
  mixed: boolean;
  current: TagDef | undefined;
  label: string;
}

/** The tag every item shares and its label, "Mixed" when they differ */
export const tagSummary = (items: { id: string }[]): TagSummary => {
  const [first, ...rest] = items;
  const tag = first ? tagFor(first.id) : undefined;

  if (rest.some((one) => tagFor(one.id)?.id !== tag?.id)) {
    return { mixed: true, current: undefined, label: "Mixed" };
  }

  return { mixed: false, current: tag, label: tag?.label ?? "No tag" };
};

/** Current tags, for writeTags to undo a bulk write */
export const snapshotTags = (targets: TagTarget[]): TagSnapshot[] =>
  targets.map((target) => ({
    ...target,
    tagId: tagFor(target.instanceId)?.id,
  }));

/** Whether the item carries a tag that guarded bulk actions skip */
export const protectedTag = (instanceId: string): boolean => {
  const def = tagFor(instanceId);

  return def !== undefined && PROTECTED.has(def.id);
};

publishDefs();
publishItems();
