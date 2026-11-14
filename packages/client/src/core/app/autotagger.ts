import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createEffect, on } from "solid-js";

import type { AutotagRule } from "@dvm/service";

import type { Membership } from "../api/bungie.ts";
import { dropped, ID_DIGITS, recency } from "../items/arrivals.ts";
import {
  autotagDemo,
  autotagRules,
  autotagState,
  autotagSynced,
  claimAutotag,
} from "../items/autotag.ts";
import { unmovable } from "../items/compare.ts";
import { sheet } from "../items/rollSheets.ts";
import { MODES } from "../items/rollTypes.ts";
import { tagTarget, writeRuleTags } from "../items/tags.ts";
import { defs } from "../profile/defs.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import { itemFilter, valid } from "../search/search.ts";
import { recordAutotag, statsLeader } from "../stats/log.ts";
import type { AutotagVault } from "../stats/types.ts";
import type { AppState } from "./state.ts";

const MOVE_WAIT_MS = 250;

const EMPTY_MARK = "0".repeat(ID_DIGITS);

interface Sources {
  current: () => LoadResult | undefined;
  stores: () => DimStore[];
  viewing: () => Membership | undefined;
  moving: () => string | undefined;
  moveAll: AppState["onMoveAll"];
}

interface Hit {
  item: DimItem;
  rule: AutotagRule;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Highest instance id held anywhere, in mark form */
export const newestMark = (stores: DimStore[]): string =>
  stores
    .flatMap((store) => store.items)
    .filter(dropped)
    .map(recency)
    .reduce((highest, mark) => (mark > highest ? mark : highest), EMPTY_MARK);

const vaultable = (item: DimItem): boolean =>
  !item.equipped &&
  !item.notransfer &&
  !unmovable(item) &&
  (!item.location.inPostmaster || item.canPullFromPostmaster);

export const createAutotagger = (sources: Sources) => {
  let working = false;
  let demoSeen: Set<string> | undefined = undefined;

  const ready = (loaded: LoadResult | undefined): loaded is LoadResult =>
    !!loaded &&
    loaded.source === "live" &&
    // Core defs carry no sockets
    loaded.tier === "detail" &&
    !loaded.session.guest &&
    !sources.viewing() &&
    // Only the leader writes the log
    statsLeader() &&
    autotagSynced() &&
    !!autotagState()?.enabled &&
    MODES.every((mode) => sheet(mode).byHash.size > 0);

  const apply = async (
    hits: Hit[],
    stores: DimStore[],
    membershipId: string,
  ) => {
    for (const rule of autotagRules()) {
      const tagged = hits.filter((hit) => hit.rule.id === rule.id);

      if (rule.tagId !== undefined && tagged.length > 0) {
        writeRuleTags(
          tagged.map((hit) => tagTarget(hit.item)),
          rule.tagId,
          rule.id,
        );
      }
    }

    const vault = stores.find((store) => store.isVault);
    const moving = hits
      .filter((hit) => hit.rule.vault && vaultable(hit.item))
      .map((hit) => hit.item);

    let moved = new Set<string>();

    if (vault && moving.length > 0) {
      // onMoveAll refuses to start while another move is in flight
      while (sources.moving()) {
        await sleep(MOVE_WAIT_MS);
      }

      const done = await sources.moveAll(moving, vault, "Vaulting");

      moved = new Set(done.map((item) => item.id));
    }

    const vaultResult = (hit: Hit): AutotagVault | undefined => {
      if (!hit.rule.vault) {
        return undefined;
      }

      if (!vaultable(hit.item)) {
        return "skipped";
      }

      return moved.has(hit.item.id) ? "moved" : "failed";
    };
    const at = Date.now();

    await recordAutotag(
      membershipId,
      hits
        .filter((hit) => hit.rule.tagId !== undefined || hit.rule.vault)
        .map((hit) => ({
          from: at,
          at,
          kind: "autotag",
          instanceId: hit.item.id,
          itemHash: hit.item.hash,
          ruleId: hit.rule.id,
          query: hit.rule.query,
          tagId: hit.rule.tagId,
          vault: vaultResult(hit),
        })),
    );
  };

  const run = async () => {
    const loaded = sources.current();
    const state = autotagState();

    if (working || !ready(loaded) || !state) {
      return;
    }

    const stores = sources.stores();
    const held = stores
      .filter((store) => !store.isVault)
      .flatMap((store) => store.items)
      .filter(dropped);

    working = true;

    try {
      let fresh: DimItem[] = [];

      if (autotagDemo()) {
        const was = demoSeen;

        demoSeen = new Set(held.map((item) => item.id));

        if (!was) {
          return;
        }

        fresh = held.filter((item) => !was.has(item.id));
      } else {
        demoSeen = undefined;

        const mark = newestMark(stores);

        if (mark <= state.mark || !(await claimAutotag(state.mark, mark))) {
          return;
        }

        fresh = held.filter((item) => recency(item) > state.mark);
      }

      const filters = autotagRules()
        .filter(
          (rule) =>
            rule.enabled && rule.query.trim() !== "" && valid(rule.query),
        )
        .map((rule) => ({
          rule,
          test: itemFilter(rule.query, stores, defs()),
        }));

      const hits = fresh.flatMap((item): Hit[] => {
        const found = filters.find((filter) => filter.test(item));

        return found ? [{ item, rule: found.rule }] : [];
      });

      if (hits.length === 0) {
        return;
      }

      await apply(hits, stores, loaded.session.membership.membershipId);
    } finally {
      working = false;
    }
  };

  createEffect(
    on(
      [sources.current, autotagSynced, autotagState, statsLeader],
      () => void run(),
    ),
  );
};
