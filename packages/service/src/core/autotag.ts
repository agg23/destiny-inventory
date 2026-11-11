const MAX_RULES = 200;

const MAX_QUERY_LENGTH = 1_000;

/** Instance ids zero padded to this many digits sort as text */
export const MARK_DIGITS = 20;

const MARK = new RegExp(`^[0-9]{${MARK_DIGITS}}$`);

export interface AutotagRule {
  id: string;
  query: string;
  tagId: string | undefined;
  vault: boolean;
  enabled: boolean;
  position: number;
  removed: boolean;
  updatedAt: number;
}

export type AutotagRuleChange = Omit<AutotagRule, "updatedAt">;

export interface AutotagState {
  enabled: boolean;
  /** Highest instance id already handled */
  mark: string;
  updatedAt: number;
}

export type AutotagStateChange =
  | { kind: "enable"; mark: string }
  | { kind: "disable" }
  | { kind: "claim"; from: string; to: string };

export interface AutotagSnapshot {
  rules: AutotagRule[];
  state: AutotagState | undefined;
}

export interface AutotagStore {
  read: (membershipId: string, since: number) => Promise<AutotagSnapshot>;
  write: (
    membershipId: string,
    changes: AutotagRuleChange[],
    now: number,
  ) => Promise<void>;
  /** False when a claim lost to another tab, or nothing is enabled */
  writeState: (
    membershipId: string,
    change: AutotagStateChange,
    now: number,
  ) => Promise<boolean>;
}

const text = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : undefined;

const readRule = (raw: unknown): AutotagRuleChange | undefined => {
  const { id, query, tagId, vault, enabled, position, removed } = (raw ??
    {}) as Record<string, unknown>;

  const cleanId = text(id, 200);
  const cleanQuery = text(query, MAX_QUERY_LENGTH);
  const cleanTagId = tagId === undefined ? undefined : text(tagId, 200);

  if (
    cleanId === undefined ||
    cleanQuery === undefined ||
    (tagId !== undefined && cleanTagId === undefined) ||
    typeof position !== "number" ||
    !Number.isSafeInteger(position)
  ) {
    return undefined;
  }

  return {
    id: cleanId,
    query: cleanQuery,
    tagId: cleanTagId,
    vault: !!vault,
    enabled: !!enabled,
    position,
    removed: !!removed,
  };
};

/** Undefined when the body is not a well formed batch of rule changes */
export const parseRules = (body: unknown): AutotagRuleChange[] | undefined => {
  const { rules } = (body ?? {}) as Record<string, unknown>;

  if (!Array.isArray(rules) || rules.length === 0 || rules.length > MAX_RULES) {
    return undefined;
  }

  const clean = rules.flatMap((raw) => {
    const rule = readRule(raw);

    return rule ? [rule] : [];
  });

  // Partial writes would silently drop changes
  if (clean.length !== rules.length) {
    return undefined;
  }

  return clean;
};

const isMark = (value: unknown): value is string =>
  typeof value === "string" && MARK.test(value);

export const parseStateChange = (
  body: unknown,
): AutotagStateChange | undefined => {
  const { kind, mark, from, to } = (body ?? {}) as Record<string, unknown>;

  if (kind === "enable" && isMark(mark)) {
    return { kind, mark };
  }

  if (kind === "disable") {
    return { kind };
  }

  if (kind === "claim" && isMark(from) && isMark(to) && to > from) {
    return { kind, from, to };
  }

  return undefined;
};
