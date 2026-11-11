import { createSignal } from "solid-js";

import type { AutotagRule, AutotagState } from "@dvm/service";

import { callService } from "../api/auth.ts";
import { readStored, writeStored } from "../storage.ts";
import { mergeNewer } from "./sync.ts";

const KEY = "dvm.autotag";

const DEMO_KEY = "dvm.autotagDemo";

const ENDPOINT = "/api/autotag";

const STATE_ENDPOINT = "/api/autotag/state";

interface Held {
  rules: AutotagRule[];
  since: number;
}

/** A rule as the editor holds it. Order is position */
export interface RuleDraft {
  id: string;
  query: string;
  tagId: string | undefined;
  vault: boolean;
  enabled: boolean;
}

const EMPTY: Held = { rules: [], since: 0 };

const restore = (): Held => {
  const parsed = readStored(KEY) as Partial<Held> | undefined;

  if (!parsed) {
    return EMPTY;
  }

  return {
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    since: typeof parsed.since === "number" ? parsed.since : 0,
  };
};

let held: Held = restore();

const [rules, setRules] = createSignal<AutotagRule[]>([]);

const [state, setState] = createSignal<AutotagState | undefined>(undefined);

const [synced, setSynced] = createSignal(false);

/** Live rules in evaluation order */
export const autotagRules = rules;

export const autotagState = state;

/** The search of a live rule, undefined once it is removed */
export const ruleQuery = (ruleId: string): string | undefined =>
  rules().find((rule) => rule.id === ruleId)?.query;

/** Rules and state have come from the service since this page loaded */
export const autotagSynced = synced;

/** Console only. Drops new to a character since the last run count as new, nothing is claimed */
export const autotagDemo = (): boolean => readStored(DEMO_KEY) === true;

const publish = () =>
  setRules(
    held.rules
      .filter((rule) => !rule.removed)
      .sort((one, two) => one.position - two.position),
  );

const save = () => {
  try {
    writeStored(KEY, held);
  } catch {
    // Quota or private mode, server still has it
  }
};

/** Pulls rules newer than the last sync, and the whole state */
export const syncAutotag = async (): Promise<void> => {
  const response = await callService(`${ENDPOINT}?since=${held.since}`);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json()) as {
    rules: AutotagRule[];
    state: AutotagState | undefined;
    now: number;
  };

  held = {
    rules: mergeNewer(held.rules, body.rules, (rule) => rule.id),
    since: body.now,
  };

  save();
  publish();
  setState(body.state);
  setSynced(true);
};

const differs = (rule: AutotagRule, draft: RuleDraft, position: number) =>
  rule.query !== draft.query ||
  rule.tagId !== draft.tagId ||
  rule.vault !== draft.vault ||
  rule.enabled !== draft.enabled ||
  rule.position !== position;

/** Writes whatever differs from the saved rules. False when the service did not take it */
export const saveAutotagRules = async (
  drafts: RuleDraft[],
): Promise<boolean> => {
  const current = new Map(rules().map((rule) => [rule.id, rule]));
  const kept = new Set(drafts.map((draft) => draft.id));

  const changes = [
    ...drafts.flatMap((draft, position) => {
      const rule = current.get(draft.id);

      if (rule && !differs(rule, draft, position)) {
        return [];
      }

      return [{ ...draft, position, removed: false }];
    }),
    ...rules()
      .filter((rule) => !kept.has(rule.id))
      .map((rule) => ({
        id: rule.id,
        query: rule.query,
        tagId: rule.tagId,
        vault: rule.vault,
        enabled: rule.enabled,
        position: rule.position,
        removed: true,
      })),
  ];

  if (changes.length === 0) {
    return true;
  }

  const response = await callService(ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ rules: changes }),
  });

  if (!response?.ok) {
    return false;
  }

  const { now } = (await response.json()) as { now: number };

  held = {
    ...held,
    rules: mergeNewer(
      held.rules,
      changes.map((change) => ({ ...change, updatedAt: now })),
      (rule) => rule.id,
    ),
  };

  save();
  publish();

  return true;
};

const postState = async (body: object): Promise<boolean> => {
  const response = await callService(STATE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response?.ok) {
    return false;
  }

  const { applied } = (await response.json()) as { applied: boolean };

  return applied;
};

/** Turning it on skips everything up to mark, unless it was already on */
export const setAutotagEnabled = async (
  enabled: boolean,
  mark: string,
): Promise<boolean> => {
  const applied = await postState(
    enabled ? { kind: "enable", mark } : { kind: "disable" },
  );

  await syncAutotag();

  return applied;
};

/** Moves the mark from one instance id to another. False when another tab got there first */
export const claimAutotag = async (
  from: string,
  to: string,
): Promise<boolean> => {
  const claimed = await postState({ kind: "claim", from, to });

  if (!claimed) {
    await syncAutotag();

    return false;
  }

  setState((was) => (was ? { ...was, mark: to, updatedAt: Date.now() } : was));

  return true;
};

publish();
