// Rows are never deleted. A removal is the flag plus a fresh timestamp

const MAX_CHANGES = 1_000;

export interface TagDef {
  id: string;
  label: string;
  color: string;
  position: number;
  removed: boolean;
  updatedAt: number;
}

export interface ItemTag {
  instanceId: string;
  itemHash: number;
  tagId: string;
  removed: boolean;
  updatedAt: number;
}

export type TagDefChange = Omit<TagDef, "updatedAt">;

export type ItemTagChange = Omit<ItemTag, "updatedAt">;

export interface TagSnapshot {
  defs: TagDef[];
  items: ItemTag[];
}

export interface TagWrite {
  defs: TagDefChange[];
  items: ItemTagChange[];
}

export interface TagStore {
  read: (membershipId: string, since: number) => Promise<TagSnapshot>;
  write: (
    membershipId: string,
    changes: TagWrite,
    now: number,
  ) => Promise<void>;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= 200
    ? value
    : undefined;

const whole = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;

const readDef = (raw: unknown): TagDefChange | undefined => {
  const { id, label, color, position, removed } = (raw ?? {}) as Record<
    string,
    unknown
  >;

  const cleanId = text(id);
  const cleanLabel = text(label);
  const cleanColor = text(color);
  const cleanPosition = whole(position);

  if (
    cleanId === undefined ||
    cleanLabel === undefined ||
    cleanColor === undefined ||
    cleanPosition === undefined
  ) {
    return undefined;
  }

  return {
    id: cleanId,
    label: cleanLabel,
    color: cleanColor,
    position: cleanPosition,
    removed: !!removed,
  };
};

const readItem = (raw: unknown): ItemTagChange | undefined => {
  const { instanceId, itemHash, tagId, removed } = (raw ?? {}) as Record<
    string,
    unknown
  >;

  const cleanInstanceId = text(instanceId);
  const cleanItemHash = whole(itemHash);
  const cleanTagId = text(tagId);

  if (
    cleanInstanceId === undefined ||
    cleanItemHash === undefined ||
    cleanTagId === undefined
  ) {
    return undefined;
  }

  return {
    instanceId: cleanInstanceId,
    itemHash: cleanItemHash,
    tagId: cleanTagId,
    removed: !!removed,
  };
};

/** Undefined when the body is not a well formed batch of changes */
export const parseWrite = (body: unknown): TagWrite | undefined => {
  const { defs, items } = (body ?? {}) as Record<string, unknown>;
  const rawDefs = Array.isArray(defs) ? defs : [];
  const rawItems = Array.isArray(items) ? items : [];

  if (rawDefs.length + rawItems.length > MAX_CHANGES) {
    return undefined;
  }

  const clean: TagWrite = {
    defs: rawDefs.flatMap((raw) => {
      const def = readDef(raw);

      return def ? [def] : [];
    }),
    items: rawItems.flatMap((raw) => {
      const item = readItem(raw);

      return item ? [item] : [];
    }),
  };

  // A partial write would silently lose changes the client thinks it sent
  if (
    clean.defs.length !== rawDefs.length ||
    clean.items.length !== rawItems.length
  ) {
    return undefined;
  }

  return clean;
};
