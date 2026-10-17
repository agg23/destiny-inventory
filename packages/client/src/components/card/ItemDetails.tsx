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

interface StatPlace {
  hash: number;
  total: boolean;
  best: number | undefined;
  against: DimStat | undefined;
}

interface DetailPlace {
  column: string;
  statColumn: string;
  comparing: boolean;
  stats: StatPlace[];
}

const LEAD_ROW = 2;
const SUMMARY_ROW = 3;
const STATS_ROW = 4;

/** An item's details below its header. Writes into the parent grid when given a place */
export const ItemDetails = (props: {
  item: DimItem;
  against?: DimItem;
  place?: DetailPlace;
  allPerks?: boolean;
  onToggleAllPerks?: () => void;
  lead?: JSX.Element;
  trail?: JSX.Element;
  hideRollWarning?: boolean;
  catalyst?: Catalyst;
}) => {
  const uninstanced = () => props.item.id === "0";
  const perksRow = () => STATS_ROW + (props.place?.stats.length ?? 0);
  const own = (hash: number) =>
    props.item.stats?.find((stat) => stat.statHash === hash);
  const boosted = createMemo(() => masterworkHashes(props.item));

  const cell = (row: number) => ({
    "grid-column": props.place!.column,
    "grid-row": String(row),
  });

  const rollWarning = () => uninstanced() && !props.hideRollWarning;

  const warning = (
    <p class="text-xs text-warning">
      <b class="font-medium">Generic roll</b>
      <span class="block">
        Stats and perks come from the definition. The weapon that was used may
        have rolled differently.
      </span>
    </p>
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
          <Show when={rollWarning()}>
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
            <Show when={rollWarning()}>{warning}</Show>
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
