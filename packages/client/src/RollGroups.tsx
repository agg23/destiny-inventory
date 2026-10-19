import type { DimItem, DimPlug, DimSocket } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, createSignal, For, Show } from "solid-js";

import { OptionMark } from "./components/card/AegisNote.tsx";
import { typeName } from "./components/card/ItemHead.tsx";
import { ItemTile } from "./components/ItemTile.tsx";
import { LABEL } from "./components/lib/text.ts";
import { NameCounts } from "./components/NameCounts.tsx";
import { verdictFor } from "./core/items/arrivals.ts";
import { dismissPerk, previewPerk } from "./core/items/perkPreview.ts";
import { assess, TIERS } from "./core/items/rolls.ts";
import type { Mode } from "./core/items/rollTypes.ts";
import { shownModes } from "./core/settings.ts";

// SocketCategoryHashes.WeaponPerks
const WEAPON_PERKS = 4241085061;

// Every weapon column in the profile rolls at most three
const CELLS = 3;

interface Perk {
  item: DimItem;
  plug: DimPlug;
  name: string;
  modes: Mode[];
}

interface Copy {
  item: DimItem;
  labels: string[];
  columns: Perk[][];
  wanted: number;
  rank: number;
  worse: boolean;
}

interface Group {
  name: string;
  type: string;
  copies: Copy[];
}

interface Cell {
  perk: Perk;
  same: boolean;
}

const perkColumns = (item: DimItem): DimSocket[] => {
  const sockets = item.sockets;
  const category = sockets?.categories.find(
    (one) => one.category.hash === WEAPON_PERKS,
  );

  if (!sockets || sockets.fromDefinitions || !category) {
    return [];
  }

  return category.socketIndexes.flatMap((index) => {
    const socket = sockets.allSockets.find((one) => one.socketIndex === index);

    if (
      !socket ||
      socket.plugOptions.length === 0 ||
      socket.plugOptions.some((plug) =>
        plug.plugDef.plug.plugCategoryIdentifier.includes("trackers"),
      )
    ) {
      return [];
    }

    return [socket];
  });
};

const copyOf = (item: DimItem, modes: Mode[]): Copy => {
  const wantedBy = new Map<number, Mode[]>();
  const rolled = new Set<number>();
  let rank: number = TIERS.length;

  for (const mode of modes) {
    const read = assess(item, mode);

    if (!read) {
      continue;
    }

    if (read.overall) {
      rank = Math.min(rank, TIERS.indexOf(read.overall));
    }

    for (const slot of read.slots) {
      for (const option of slot.options) {
        rolled.add(option.hash);

        if (option.wanted) {
          wantedBy.set(option.hash, [
            ...(wantedBy.get(option.hash) ?? []),
            mode,
          ]);
        }
      }
    }
  }

  const sockets = perkColumns(item);
  let rated = 0;

  const labels = sockets.map((socket) => {
    if (socket.plugOptions.some((plug) => rolled.has(plug.plugDef.hash))) {
      rated += 1;

      return `Perk ${rated}`;
    }

    // Enhanced perks name their slot "Enhanced Barrel"
    const type = socket.plugOptions[0]!.plugDef.itemTypeDisplayName.replace(
      /^Enhanced /,
      "",
    );

    return type === "" ? "Perk" : type;
  });

  return {
    item,
    labels,
    columns: sockets.map((socket) =>
      socket.plugOptions.map((plug) => ({
        item,
        plug,
        name: plug.plugDef.displayProperties.name,
        modes: wantedBy.get(plug.plugDef.hash) ?? [],
      })),
    ),
    wanted: wantedBy.size,
    rank,
    worse: false,
  };
};

// Perks the reference also rolled keep its cell, so matches line up down the group
const cellsOf = (
  copy: Copy,
  reference: Copy,
  index: number,
): (Cell | undefined)[] => {
  const mine = copy.columns[index] ?? [];
  const theirs = (reference.columns[index] ?? []).map((perk) => perk.name);
  const cells: (Cell | undefined)[] = Array.from(
    { length: Math.max(CELLS, mine.length) },
    () => undefined,
  );
  const unplaced: Perk[] = [];

  for (const perk of mine) {
    const at = theirs.indexOf(perk.name);

    if (copy !== reference && at >= 0 && cells[at] === undefined) {
      cells[at] = { perk, same: true };
    } else {
      unplaced.push(perk);
    }
  }

  for (const perk of unplaced) {
    const at = cells.findIndex((cell) => cell === undefined);

    cells[at] = { perk, same: false };
  }

  return cells;
};

const PerkCell = (props: { cell: Cell | undefined; judges: number }) => (
  <Show when={props.cell} fallback={<span />}>
    {(cell) => (
      <span
        class="flex min-w-0 items-baseline gap-1"
        classList={{ "text-muted-foreground": cell().same }}
        title={cell().perk.name}
        onMouseEnter={(event) =>
          previewPerk(cell().perk.item, cell().perk.plug, event.currentTarget)
        }
        onMouseLeave={() => dismissPerk(cell().perk.plug)}
      >
        <Show when={cell().perk.modes.length > 0}>
          <OptionMark
            option={{ wantedBy: cell().perk.modes }}
            judges={props.judges}
          />
        </Show>
        <span class="truncate">{cell().perk.name}</span>
      </span>
    )}
  </Show>
);

/** The selection's weapons grouped by name, each copy's perks on a grid against a reference copy */
export const RollGroups = (props: {
  items: DimItem[];
  stores: DimStore[];
  onSelect: (item: DimItem, event: MouseEvent) => void;
}) => {
  const [references, setReferences] = createSignal<ReadonlyMap<string, string>>(
    new Map(),
  );

  const split = createMemo(() => {
    const modes = shownModes();
    const byName = new Map<string, Group>();
    const rest: DimItem[] = [];

    for (const item of props.items) {
      if (!item.bucket.inWeapons || perkColumns(item).length === 0) {
        rest.push(item);

        continue;
      }

      const group = byName.get(item.name) ?? {
        name: item.name,
        type: typeName(item),
        copies: [],
      };

      group.copies.push(copyOf(item, modes));
      byName.set(item.name, group);
    }

    const groups = [...byName.values()];

    for (const group of groups) {
      for (const copy of group.copies) {
        copy.worse =
          verdictFor(copy.item, props.stores, modes)?.kind === "worse";
      }

      group.copies.sort((a, b) => a.rank - b.rank || b.wanted - a.wanted);
    }

    groups.sort(
      (a, b) =>
        b.copies.length - a.copies.length || a.name.localeCompare(b.name),
    );

    return { groups, rest, judges: modes.length };
  });

  const referenceOf = (group: Group): Copy =>
    group.copies.find(
      (copy) => copy.item.id === references().get(group.name),
    ) ?? group.copies[0]!;

  const choose = (group: Group, copy: Copy) =>
    setReferences((was) => new Map(was).set(group.name, copy.item.id));

  const sameRoll = (copy: Copy, reference: Copy): boolean =>
    copy.columns.every((_, index) =>
      cellsOf(copy, reference, index).every((cell) => !cell || cell.same),
    );

  return (
    <div class="flex flex-col gap-4">
      <For each={split().groups}>
        {(group) => (
          <section class="flex flex-col">
            <h3 class={`${LABEL} mb-1 flex items-baseline gap-2`}>
              <span class="truncate text-foreground">{group.name}</span>
              <span class="truncate">{group.type}</span>
              <span class="ml-auto tabular-nums">{group.copies.length}</span>
            </h3>
            <For each={group.copies}>
              {(copy) => {
                const reference = () => referenceOf(group);
                const isReference = () => reference() === copy;

                return (
                  <div class="flex flex-col gap-1.5 border-t py-2 first-of-type:border-t-0">
                    <div class="flex items-center gap-3">
                      <ItemTile item={copy.item} onSelect={props.onSelect} />
                      <span
                        class="text-xs"
                        classList={{
                          "text-muted-foreground": !copy.worse || isReference(),
                          "text-destructive": copy.worse && !isReference(),
                        }}
                      >
                        {isReference()
                          ? "Reference"
                          : copy.worse
                            ? "Worse perks"
                            : sameRoll(copy, reference())
                              ? "Same roll"
                              : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="-mx-1.5 grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] gap-x-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-4 hover:bg-accent"
                      classList={{ "bg-accent": isReference() }}
                      title={isReference() ? undefined : "Compare against this"}
                      onClick={() => choose(group, copy)}
                    >
                      <For each={copy.columns}>
                        {(_, index) => (
                          <>
                            <span class="truncate text-muted-foreground">
                              {copy.labels[index()]}
                            </span>
                            <For each={cellsOf(copy, reference(), index())}>
                              {(cell) => (
                                <PerkCell cell={cell} judges={split().judges} />
                              )}
                            </For>
                          </>
                        )}
                      </For>
                    </button>
                  </div>
                );
              }}
            </For>
          </section>
        )}
      </For>

      <Show when={split().rest.length > 0}>
        <NameCounts items={split().rest} />
      </Show>
    </div>
  );
};
