import { createSignal } from "solid-js";

import type { ItemTag, TagDef, TagDefChange } from "@dvm/service";

import { renewSession, sessionToken } from "./auth.ts";

const KEY = "dvm.tags";

const ENDPOINT = "/api/tags";

const FLUSH_MS = 500;

interface Held {
  defs: TagDef[];
  items: ItemTag[];
  since: number;
}

const EMPTY: Held = { defs: [], items: [], since: 0 };

// Colors from tokens.css
const DEFAULT_DEFS: TagDef[] = [
  {
    id: "favorite",
    label: "Favorite",
    color: "exotic",
    position: 0,
    removed: false,
    updatedAt: 0,
  },
  {
    id: "keep",
    label: "Keep",
    color: "good",
    position: 1,
    removed: false,
    updatedAt: 0,
  },
  {
    id: "junk",
    label: "Junk",
    color: "error",
    position: 2,
    removed: false,
    updatedAt: 0,
  },
  {
    id: "infuse",
    label: "Infuse",
    color: "arc",
    position: 3,
    removed: false,
    updatedAt: 0,
  },
  {
    id: "archive",
    label: "Archive",
    color: "void",
    position: 4,
    removed: false,
    updatedAt: 0,
  },
];

const itemKey = (item: ItemTag): string => `${item.instanceId}/${item.tagId}`;

const restore = (): Held => {
  const raw = localStorage.getItem(KEY);

  if (raw === null) {
    return EMPTY;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Held>;

    return {
      defs: Array.isArray(parsed.defs) ? parsed.defs : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      since: typeof parsed.since === "number" ? parsed.since : 0,
    };
  } catch {
    return EMPTY;
  }
};

let held: Held = restore();

const [defs, setDefs] = createSignal<TagDef[]>([]);

const [assigned, setAssigned] = createSignal<
  ReadonlyMap<string, ReadonlySet<string>>
>(new Map());

/** Tag definitions in display order, with removed ones dropped */
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

    const existing = map.get(item.instanceId);

    if (existing) {
      existing.add(item.tagId);
      continue;
    }

    map.set(item.instanceId, new Set([item.tagId]));
  }

  return map;
};

// Stored definitions are synced but not read yet. There is no editor, so anything in the
// table is leftover test data, and honoring it would hide the defaults
const publishDefs = () => {
  setDefs(
    [...DEFAULT_DEFS].sort((one, two) => one.position - two.position),
  );
};

const publishItems = () => setAssigned(index(held.items));

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(held));
  } catch {
    // Quota or private mode, and the server still holds it
  }
};

const merge = <T extends { updatedAt: number }>(
  current: T[],
  incoming: T[],
  keyOf: (row: T) => string,
): T[] => {
  const map = new Map(current.map((row) => [keyOf(row), row]));

  for (const row of incoming) {
    const existing = map.get(keyOf(row));

    if (!existing || row.updatedAt >= existing.updatedAt) {
      map.set(keyOf(row), row);
    }
  }

  return [...map.values()];
};

const call = async (
  path: string,
  init?: RequestInit,
): Promise<Response | undefined> => {
  const token = await sessionToken();

  if (!token) {
    return undefined;
  }

  const send = (bearer: string) =>
    fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
    });

  const response = await send(token);

  if (response.status !== 401) {
    return response;
  }

  const renewed = await renewSession();

  return renewed ? send(renewed) : undefined;
};

interface Served {
  defs: TagDef[];
  items: ItemTag[];
  now: number;
}

/** Pulls everything newer than the last sync, removals included */
export const syncTags = async (): Promise<void> => {
  const response = await call(`${ENDPOINT}?since=${held.since}`);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json()) as Served;

  held = {
    defs: merge(held.defs, body.defs, (def) => def.id),
    items: merge(held.items, body.items, itemKey),
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

  const response = await call(ENDPOINT, {
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

  // Nothing is dropped on a failure. The next change carries these along
  if (!response?.ok) {
    queued = merge(sending, queued, itemKey);
  }
};

const queue = (changes: ItemTag[]) => {
  if (changes.length === 0) {
    return;
  }

  held = { ...held, items: merge(held.items, changes, itemKey) };

  save();
  publishItems();

  queued = merge(queued, changes, itemKey);

  timer ??= setTimeout(() => void flush(), FLUSH_MS);
};

/** Creates or updates one tag definition. Rare and deliberate, so it reports a failure */
export const saveTagDef = async (def: TagDefChange): Promise<boolean> => {
  const response = await call(ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ defs: [def], items: [] }),
  });

  if (!response?.ok) {
    return false;
  }

  await syncTags();

  return true;
};

/** Sets the tag an item carries, clearing any other. Undefined leaves it untagged */
export const setOnlyTag = (
  instanceId: string,
  itemHash: number,
  tagId: string | undefined,
): void => {
  // DIM gives every non-instanced item the same id, and one tag would land on all of them
  if (instanceId === "0") {
    return;
  }

  const updatedAt = Date.now();
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

  queue(
    tagId === undefined
      ? cleared
      : [
          ...cleared,
          { instanceId, itemHash, tagId, removed: false, updatedAt },
        ],
  );
};

publishDefs();
publishItems();
