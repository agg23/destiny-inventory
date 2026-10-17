import type { DimItem, DimStat } from "app/inventory/item-types";
import { createMemo, For, Show, type JSX } from "solid-js";

import type { Catalyst } from "../../core/collections/types.ts";
import { AegisNote } from "./AegisNote.tsx";
import {
  Archetype,
  Catalysts,
  Intrinsics,
  Masterwork,
  SetBonus,
} from "./PerkDetails.tsx";
import { Perks } from "./Perks.tsx";
import {
  masterworkHashes,
  StatBar,
  Stats,
  StatValue,
  TOTAL_ROW,
} from "./Stats.tsx";

/** One stat's place in the shared grid, worked out across every item on screen */
export interface StatPlace {
  hash: number;
  total: boolean;
  best: number | undefined;
  against: DimStat | undefined;
}

/** Where an item sits when the details are laid out as a grid instead of a column */
export interface DetailPlace {
  /** Sections span the label column when nothing is being compared against */
  column: string;
  /** Stat cells always sit in the item's own column, beside the shared labels */
  statColumn: string;
  comparing: boolean;
  stats: StatPlace[];
}

// The grid keeps a row per section so columns line up, and the stats claim one row each
const LEAD_ROW = 2;
const SUMMARY_ROW = 3;
const STATS_ROW = 4;

/**
 * Everything shown about one item below its header. Given a place it writes itself into the
 * surrounding grid, and without one it runs top to bottom
 */
export const ItemDetails = (props: {
  item: DimItem;
  against?: DimItem;
  place?: DetailPlace;
  allPerks?: boolean;
  onToggleAllPerks?: () => void;
  lead?: JSX.Element;
  trail?: JSX.Element;
  hideRollWarning?: boolean;
  /** The account's catalyst triumph, for catalyst state and progress */
  catalyst?: Catalyst;
}) => {
  // An uninstanced item carries no roll
  const uninstanced = () => props.item.id === "0";
  const perksRow = () => STATS_ROW + (props.place?.stats.length ?? 0);
  const own = (hash: number) =>
    props.item.stats?.find((stat) => stat.statHash === hash);
  const boosted = createMemo(() => masterworkHashes(props.item));

  const cell = (row: number) => ({
    "grid-column": props.place!.column,
    "grid-row": String(row),
  });

  const warning = (
    <Show when={uninstanced() && !props.hideRollWarning}>
      <p class="text-xs text-warning">
        <b class="font-medium">Generic roll</b>
        <span class="block">
          Stats and perks come from the definition. The weapon that was used may
          have rolled differently.
        </span>
      </p>
    </Show>
  );

  const perks = (
    <Perks
      item={props.item}
      all={props.allPerks}
      onlyPlugged={uninstanced() && !props.allPerks}
      onToggleAll={props.onToggleAllPerks}
    />
  );

  return (
    <Show
      when={props.place}
      fallback={
        <>
          <div class="tooltip-body">
            <AegisNote item={props.item} />
          </div>
          <Show when={uninstanced() && !props.hideRollWarning}>
            <div class="tooltip-body">{warning}</div>
          </Show>
          <div class="tooltip-body">
            {props.lead}
            <Masterwork item={props.item} />
            <Archetype item={props.item} />
            <Intrinsics item={props.item} />
            {/* A definition's armor stats are placeholders */}
            <Show when={!uninstanced() || !props.item.bucket.inArmor}>
              <Stats item={props.item} against={props.against} />
            </Show>
          </div>
          <div class="tooltip-body">
            {perks}
            <Catalysts item={props.item} account={props.catalyst} />
            <SetBonus item={props.item} />
            {props.trail}
          </div>
        </>
      }
    >
      {(place) => (
        <>
          <Show when={props.lead}>
            <div class="min-w-0 self-start pb-3" style={cell(LEAD_ROW)}>
              {props.lead}
            </div>
          </Show>
          <div class="min-w-0 self-start" style={cell(SUMMARY_ROW)}>
            <AegisNote item={props.item} />
            {warning}
            <div class="mt-3 first:mt-0">
              <Masterwork item={props.item} />
              <Archetype item={props.item} />
              <Intrinsics item={props.item} />
            </div>
          </div>
          <For each={place().stats}>
            {(stat, row) => (
              <div
                class="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-2.5"
                classList={{ [TOTAL_ROW]: stat.total }}
                style={{
                  "grid-column": place().statColumn,
                  "grid-row": String(STATS_ROW + row()),
                }}
              >
                <Show
                  when={own(stat.hash)}
                  fallback={<span class="text-muted-foreground">·</span>}
                >
                  {(mine) => (
                    <>
                      <StatBar
                        stat={mine()}
                        total={stat.total}
                        masterworked={boosted().has(stat.hash)}
                      />
                      <StatValue
                        stat={mine()}
                        against={stat.against}
                        comparing={place().comparing}
                        best={mine().value === stat.best}
                        total={stat.total}
                      />
                    </>
                  )}
                </Show>
              </div>
            )}
          </For>
          <div class="min-w-0 self-start pt-2" style={cell(perksRow())}>
            {perks}
            <Catalysts item={props.item} account={props.catalyst} />
          </div>
          <div class="min-w-0 self-start pt-6" style={cell(perksRow() + 1)}>
            <SetBonus item={props.item} />
            {props.trail}
          </div>
        </>
      )}
    </Show>
  );
};
