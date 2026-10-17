import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { spaceLeftForItem } from "app/inventory/stores-helpers";
import { isClassCompatible } from "app/utils/item-utils";
import { createSignal } from "solid-js";

import type { AppState } from "../../App.tsx";
import { showToast } from "../../components/Toasts.tsx";
import {
  setOnlyTagMany,
  tagFor,
  type TagTarget,
} from "../../core/items/tags.ts";
import { LOST_ITEMS, storeLabel } from "../../core/profile/moveTargets.ts";
import { plural } from "../../history/shared/runFormat.ts";

const KEY = "dvm.trash";

const TRASH_TAG = "junk";

const MOVE_WAIT_MS = 250;

// One auto refresh
const DRY_DISMANTLE_MS = 15_000;

export type TrashPhase = "evacuating" | "feeding" | "waiting" | "restoring";

export interface TrashRun {
  characterId: string;
  bucketHash: number;
  dry: boolean;
  phase: TrashPhase;
  holdback: string[];
  fed: TagTarget[];
  skipped: string[];
  dismantled: string[];
  interrupted: boolean;
}

const restore = (): TrashRun | undefined => {
  try {
    const raw = localStorage.getItem(KEY);

    if (raw === null) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as TrashRun;

    return typeof parsed.characterId === "string"
      ? { ...parsed, interrupted: true }
      : undefined;
  } catch {
    return undefined;
  }
};

const [run, setRun] = createSignal<TrashRun | undefined>(restore());
const [stopping, setStopping] = createSignal(false);

/** The run in progress, or the one a closed tab left behind */
export const trashRun = run;

export const trashStopping = stopping;

const save = (next: TrashRun | undefined) => {
  setRun(next);

  try {
    if (next === undefined) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(next));
    }
  } catch {
    // Quota or private mode. Only crash recovery is lost
  }
};

const patch = (change: Partial<TrashRun>) => {
  const was = run();

  if (was) {
    save({ ...was, ...change });
  }
};

const isTrash = (item: DimItem): boolean => tagFor(item.id)?.id === TRASH_TAG;

const targetOf = (item: DimItem): TagTarget => ({
  instanceId: item.id,
  itemHash: item.hash,
});

/** Unequipped items sitting in one of a character's slots */
export const slotContents = (
  character: DimStore,
  bucketHash: number,
): DimItem[] =>
  character.items.filter(
    (item) => item.location.hash === bucketHash && !item.equipped,
  );

/** Trash for one slot that the character could dismantle, wherever it sits */
export const trashFor = (
  stores: DimStore[],
  character: DimStore,
  bucketHash: number,
): DimItem[] =>
  stores
    .flatMap((store) => store.items)
    .filter(
      (item) =>
        item.bucket.hash === bucketHash &&
        isTrash(item) &&
        !item.equipped &&
        item.location.hash !== LOST_ITEMS &&
        (item.owner === character.id || !item.notransfer) &&
        isClassCompatible(item.classType, character.classType),
    );

/** Trash still waiting to be moved in */
export const trashQueue = (
  held: TrashRun,
  stores: DimStore[],
  character: DimStore,
): DimItem[] => {
  const done = new Set([
    ...held.fed.map((one) => one.instanceId),
    ...held.skipped,
    ...held.dismantled,
  ]);

  return trashFor(stores, character, held.bucketHash).filter(
    (item) => item.owner !== character.id && !done.has(item.id),
  );
};

let app: AppState | undefined = undefined;
let working: Promise<void> | undefined = undefined;
let again = false;
let forced = false;
let dryTimer: ReturnType<typeof setTimeout> | undefined = undefined;

export const bindTrash = (bound: AppState) => {
  app = bound;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const gateOpen = (held: TrashRun): boolean =>
  held.dry || app?.playing() === held.characterId;

/** The run's character left the game, so feeding waits */
export const trashPaused = (): boolean => {
  const held = run();

  return (
    held !== undefined &&
    !held.interrupted &&
    (held.phase === "feeding" || held.phase === "waiting") &&
    !gateOpen(held)
  );
};

const move = async (
  held: TrashRun,
  items: DimItem[],
  target: DimStore,
  verb: string,
  stoppable: boolean,
): Promise<DimItem[]> => {
  if (!app || items.length === 0) {
    return [];
  }

  if (held.dry) {
    for (const item of items) {
      console.info(`Dry run: ${verb} ${item.name} to ${storeLabel(target)}`);
    }

    return items;
  }

  // onMoveAll refuses to start while another move is in flight
  while (app.moving()) {
    await sleep(MOVE_WAIT_MS);
  }

  return app.onMoveAll(items, target, verb, stoppable ? stopping : undefined);
};

const pretendDismantle = () => {
  const held = run();

  clearTimeout(dryTimer);
  dryTimer = undefined;

  if (!held || held.phase !== "waiting" || held.fed.length === 0) {
    return;
  }

  console.info(`Dry run: dismantled ${plural(held.fed.length, "item")}`);
  patch({
    fed: [],
    dismantled: [...held.dismantled, ...held.fed.map((one) => one.instanceId)],
  });
};

const settle = (change: Partial<TrashRun>, next: TrashPhase) =>
  patch({ ...change, phase: stopping() ? "restoring" : next });

const advance = async (): Promise<boolean> => {
  const held = run();

  if (!app || !held || held.interrupted) {
    return false;
  }

  const stores = app.stores();
  const character = stores.find((store) => store.id === held.characterId);
  const vault = stores.find((store) => store.isVault);
  const bucket = app.loaded()?.buckets.byHash[held.bucketHash];

  if (!character || !vault || !bucket) {
    return false;
  }

  const items = new Map(
    stores.flatMap((store) => store.items).map((item) => [item.id, item]),
  );

  if (held.phase === "restoring") {
    const leftovers = held.fed.flatMap((one) => {
      const item = items.get(one.instanceId);

      return item && (held.dry || item.owner === character.id) ? [item] : [];
    });

    const returning = held.holdback.flatMap((id) => {
      const item = items.get(id);

      return item && (held.dry || item.owner !== character.id) ? [item] : [];
    });

    await move(held, leftovers, vault, "Returning", false);
    await move(held, returning, character, "Restoring", false);

    showToast(
      `${bucket.name} ${stopping() ? "stopped" : "done"} · ${
        held.dismantled.length
      } dismantled`,
    );
    save(undefined);
    setStopping(false);

    return false;
  }

  // Stores are mid-update during a move
  if (!held.dry && !app.moving()) {
    const vanished = held.fed.filter((one) => !items.has(one.instanceId));

    if (vanished.length > 0) {
      setOnlyTagMany(vanished, undefined);
      patch({
        fed: held.fed.filter((one) => items.has(one.instanceId)),
        dismantled: [
          ...held.dismantled,
          ...vanished.map((one) => one.instanceId),
        ],
      });
    }
  }

  const known = new Set([
    ...held.fed.map((one) => one.instanceId),
    ...held.holdback,
    ...held.dismantled,
  ]);
  const adopted = slotContents(character, held.bucketHash).filter(
    (item) => isTrash(item) && !known.has(item.id),
  );

  if (adopted.length > 0) {
    patch({ fed: [...run()!.fed, ...adopted.map(targetOf)] });
  }

  const now = run()!;
  const queue = trashQueue(now, stores, character);
  const used = now.dry
    ? now.fed.length
    : slotContents(character, now.bucketHash).length;
  const room = bucket.capacity - 1 - used;

  if (now.phase === "evacuating") {
    const leaving = now.holdback.flatMap((id) => {
      const item = items.get(id);

      return item && (now.dry || item.owner === character.id) ? [item] : [];
    });

    const moved = new Set(
      (await move(now, leaving, vault, "Clearing", true)).map(
        (item) => item.id,
      ),
    );

    // Failed moves never left the slot
    settle(
      {
        holdback: now.holdback.filter(
          (id) => moved.has(id) || !leaving.some((item) => item.id === id),
        ),
      },
      "feeding",
    );

    return true;
  }

  if (now.phase === "feeding") {
    if (!gateOpen(now)) {
      return false;
    }

    const batch = queue.slice(0, Math.max(0, room));
    const moved = await move(now, batch, character, "Loading", true);
    const movedIds = new Set(moved.map((item) => item.id));
    const after = run()!;

    forced = false;
    settle(
      {
        fed: [...after.fed, ...moved.map(targetOf)],
        skipped: [
          ...after.skipped,
          ...batch
            .filter((item) => !movedIds.has(item.id))
            .map((item) => item.id),
        ],
      },
      "waiting",
    );

    return true;
  }

  if (now.fed.length === 0 && queue.length === 0) {
    patch({ phase: "restoring" });

    return true;
  }

  if (
    (now.fed.length === 0 || forced) &&
    queue.length > 0 &&
    room > 0 &&
    gateOpen(now)
  ) {
    patch({ phase: "feeding" });

    return true;
  }

  if (now.dry && now.fed.length > 0 && dryTimer === undefined) {
    dryTimer = setTimeout(() => {
      dryTimer = undefined;
      pretendDismantle();
      void advanceTrash();
    }, DRY_DISMANTLE_MS);
  }

  return false;
};

/** Moves the run along as far as the current stores allow */
export const advanceTrash = (): Promise<void> => {
  if (working) {
    again = true;

    return working;
  }

  working = (async () => {
    try {
      let progressed = true;

      while (progressed || again) {
        again = false;
        progressed = await advance();
      }
    } catch (e: unknown) {
      console.warn("Trash run failed", e);
    } finally {
      working = undefined;
    }
  })();

  return working;
};

export interface TrashPlan {
  holdback: DimItem[];
  trash: DimItem[];
  blocked: string | undefined;
}

/** What a run on the slot would move, and why it can't start */
export const planTrash = (
  stores: DimStore[],
  character: DimStore,
  bucketHash: number,
): TrashPlan => {
  const vault = stores.find((store) => store.isVault);
  const holdback = slotContents(character, bucketHash).filter(
    (item) => !isTrash(item),
  );
  let blocked: string | undefined = undefined;

  if (
    vault &&
    holdback.length > 0 &&
    spaceLeftForItem(vault, holdback[0]!, stores) < holdback.length
  ) {
    blocked = `The vault needs ${plural(holdback.length, "free slot")}`;
  }

  return {
    holdback,
    trash: trashFor(stores, character, bucketHash),
    blocked,
  };
};

/** Starts a run on one of the character's slots, or says why it can't */
export const startTrash = (
  character: DimStore,
  bucketHash: number,
  dry: boolean,
): string | undefined => {
  if (!app || run()) {
    return "A trash run is already going";
  }

  const plan = planTrash(app.stores(), character, bucketHash);

  if (plan.blocked) {
    return plan.blocked;
  }

  save({
    characterId: character.id,
    bucketHash,
    dry,
    phase: "evacuating",
    holdback: plan.holdback.map((item) => item.id),
    fed: [],
    skipped: [],
    dismantled: [],
    interrupted: false,
  });
  void advanceTrash();

  return undefined;
};

/** Refreshes now and tops up whatever room the refresh shows */
export const nextTrash = async () => {
  const held = run();

  if (!app || !held) {
    return;
  }

  if (held.dry) {
    pretendDismantle();
  } else {
    await app
      .refresh()
      .catch((e: unknown) => console.warn("Refresh failed", e));
  }

  forced = true;
  await advanceTrash();
};

/** Junk back to the vault and the holdback back to the character */
export const stopTrash = async () => {
  if (!run()) {
    return;
  }

  clearTimeout(dryTimer);
  dryTimer = undefined;
  setStopping(true);
  patch({ phase: "restoring", interrupted: false });
  await advanceTrash();

  // Missing stores leave it restoring until the next store change
  if (run()) {
    setStopping(false);
  }
};

export const dismissTrash = () => save(undefined);
