import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "../App.tsx";
import { setOnlyTag, tagFor } from "../tags.ts";
import {
  advanceTrash,
  bindTrash,
  dismissTrash,
  nextTrash,
  startTrash,
  stopTrash,
  trashPaused,
  trashRun,
} from "./trashRun.ts";

vi.mock("../toast.tsx", () => ({ showToast: vi.fn() }));

vi.mock("app/inventory/stores-helpers", () => ({
  spaceLeftForItem: () => 100,
}));

const KINETIC = 1_498_876_634;
const VAULT_BUCKET = 138_197_802;
const CHARACTER = "char";

const item = (id: string, owner: DimStore, extra: Partial<DimItem> = {}) =>
  ({
    id,
    hash: Number(id.replace(/\D/g, "")),
    name: id,
    owner: owner.id,
    bucket: { hash: KINETIC },
    location: { hash: owner.isVault ? VAULT_BUCKET : KINETIC },
    equipped: false,
    notransfer: false,
    classType: 3,
    ...extra,
  }) as DimItem;

const put = (store: DimStore, ...items: DimItem[]) => {
  (store.items as DimItem[]).push(...items);
};

const world = (playing = CHARACTER) => {
  const character = {
    id: CHARACTER,
    isVault: false,
    classType: 1,
    className: "Hunter",
    items: [] as DimItem[],
  } as unknown as DimStore;
  const vault = {
    id: "vault",
    isVault: true,
    classType: 3,
    items: [] as DimItem[],
  } as unknown as DimStore;
  let stores = [character, vault];

  const relocate = (moving: DimItem, target: DimStore) => {
    for (const store of stores) {
      store.items = store.items.filter((one) => one.id !== moving.id);
    }

    moving.owner = target.id;
    moving.location = {
      hash: target.isVault ? VAULT_BUCKET : KINETIC,
    } as DimItem["location"];
    put(target, moving);
  };

  const app = {
    stores: () => stores,
    loaded: () => ({
      buckets: {
        byHash: { [KINETIC]: { hash: KINETIC, name: "Kinetic", capacity: 10 } },
      },
    }),
    playing: () => playing,
    moving: () => undefined,
    onMoveAll: async (items: DimItem[], target: DimStore) => {
      for (const one of items) {
        relocate(one, target);
      }

      return items;
    },
    refresh: async () => {},
  } as unknown as AppState;

  bindTrash(app);

  const junk = (id: string, owner: DimStore, extra: Partial<DimItem> = {}) => {
    const made = item(id, owner, extra);
    setOnlyTag(made.id, made.hash, "junk");
    put(owner, made);

    return made;
  };

  const dismantle = (ids: string[]) => {
    stores = stores.map((store) => {
      store.items = store.items.filter((one) => !ids.includes(one.id));

      return store;
    });
  };

  return { character, vault, junk, dismantle };
};

const fedIds = () => trashRun()?.fed.map((one) => one.instanceId) ?? [];

describe("trash run", () => {
  afterEach(() => dismissTrash());

  it("evacuates, feeds, tops up, and restores the slot", async () => {
    const { character, vault, junk, dismantle } = world();

    put(character, item("e1", character, { equipped: true }));
    put(character, item("k1", character), item("k2", character));
    junk("j0", character);

    for (let at = 1; at <= 12; at += 1) {
      junk(`j${at}`, vault);
    }

    expect(startTrash(character, KINETIC, false)).toBeUndefined();
    await advanceTrash();

    expect(trashRun()?.holdback).toEqual(["k1", "k2"]);
    expect(trashRun()?.phase).toBe("waiting");
    expect(fedIds()).toEqual([
      "j0",
      "j1",
      "j2",
      "j3",
      "j4",
      "j5",
      "j6",
      "j7",
      "j8",
    ]);
    expect(vault.items.map((one) => one.id)).toContain("k1");

    const first = fedIds();
    dismantle(first);
    await advanceTrash();

    expect(fedIds()).toEqual(["j9", "j10", "j11", "j12"]);
    expect(tagFor("j3")).toBeUndefined();

    dismantle(fedIds());
    await advanceTrash();

    expect(trashRun()).toBeUndefined();
    expect(character.items.map((one) => one.id).sort()).toEqual([
      "e1",
      "k1",
      "k2",
    ]);
  });

  it("waits for Next while part of a batch is still in the slot", async () => {
    const { character, vault, junk, dismantle } = world();

    for (let at = 1; at <= 12; at += 1) {
      junk(`j${at}`, vault);
    }

    startTrash(character, KINETIC, false);
    await advanceTrash();
    dismantle(["j1", "j2"]);
    await advanceTrash();

    expect(fedIds()).toHaveLength(7);
    expect(trashRun()?.dismantled).toEqual(["j1", "j2"]);
  });

  it("puts everything back on stop", async () => {
    const { character, vault, junk } = world();

    put(character, item("k1", character));

    for (let at = 1; at <= 4; at += 1) {
      junk(`j${at}`, vault);
    }

    startTrash(character, KINETIC, false);
    await advanceTrash();
    await stopTrash();

    expect(trashRun()).toBeUndefined();
    expect(character.items.map((one) => one.id)).toEqual(["k1"]);
    expect(vault.items.map((one) => one.id).sort()).toEqual([
      "j1",
      "j2",
      "j3",
      "j4",
    ]);
  });

  it("finishes a dry run without moving anything", async () => {
    const { character, vault, junk } = world();

    put(character, item("k1", character));
    junk("j0", character);
    junk("j1", vault);

    startTrash(character, KINETIC, true);
    await advanceTrash();

    expect(fedIds()).toEqual(["j0", "j1"]);

    await nextTrash();

    expect(trashRun()).toBeUndefined();
    expect(character.items.map((one) => one.id)).toEqual(["k1", "j0"]);
    expect(vault.items.map((one) => one.id)).toEqual(["j1"]);
  });

  it("tops up a dry run on its own once the batch is dismantled", async () => {
    vi.useFakeTimers();

    const { character, vault, junk } = world();

    for (let at = 1; at <= 12; at += 1) {
      junk(`j${at}`, vault);
    }

    startTrash(character, KINETIC, true);
    await advanceTrash();

    expect(fedIds()).toHaveLength(9);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(fedIds()).toEqual(["j10", "j11", "j12"]);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(trashRun()).toBeUndefined();

    vi.useRealTimers();
  });

  it("pauses feeding while another character is in game", async () => {
    const { character, vault, junk } = world("someone else");

    junk("j1", vault);

    startTrash(character, KINETIC, false);
    await advanceTrash();

    expect(trashRun()?.phase).toBe("feeding");
    expect(trashPaused()).toBe(true);
    expect(fedIds()).toEqual([]);
  });

  it("skips gear for another class", async () => {
    const { character, vault, junk } = world();

    junk("j1", vault, { classType: 0 });
    junk("j2", vault);

    startTrash(character, KINETIC, false);
    await advanceTrash();

    expect(fedIds()).toEqual(["j2"]);
  });
});
