import type { DimItem } from "app/inventory/item-types";
import crucibleGlyph from "destiny-icons/factions/faction_crucible.svg?inline";
import vanguardGlyph from "destiny-icons/factions/faction_vanguard.svg?inline";
import { createMemo, For, Show } from "solid-js";

import {
  assess,
  MODE_NAMES,
  type Assessment,
  type Mode,
  type SlotVerdict,
} from "../../core/items/rolls.ts";
import { shownModes } from "../../core/settings.ts";
import { sentence } from "../lib/text.ts";

// Aegis ranks every weapon it covers, so a base is worth building on only near the top
const RECOMMENDED_TIERS = new Set(["S", "A", "B"]);

const recommendedBase = (tier: string | undefined): boolean =>
  tier !== undefined && RECOMMENDED_TIERS.has(tier);

const unrolled = (slot: SlotVerdict): string[] =>
  slot.picks.filter(
    (name) => !slot.options.some((option) => option.name === name),
  );

const MODE_GLYPHS: Record<Mode, string> = {
  pve: vanguardGlyph,
  pvp: crucibleGlyph,
};

/** The card's mark for a perk: a mode glyph when one sheet wants it, a check when all do */
export const OptionMark = (props: {
  option: Pick<MergedOption, "wantedBy">;
  judges: number;
}) => (
  <Show
    when={
      props.option.wantedBy.length > 0 &&
      props.option.wantedBy.length < props.judges
    }
    fallback={<AegisMark matched={props.option.wantedBy.length > 0} />}
  >
    <span
      class={`${MARK} mask-contain mask-center mask-no-repeat`}
      classList={{
        "bg-pve": props.option.wantedBy[0] === "pve",
        "bg-pvp": props.option.wantedBy[0] === "pvp",
      }}
      role="img"
      aria-label={`Wanted for ${MODE_NAMES[props.option.wantedBy[0]!]}`}
      style={{
        "mask-image": `url("${MODE_GLYPHS[props.option.wantedBy[0]!]}")`,
      }}
    />
  </Show>
);

// Baseline aligning an svg sits its box on the baseline, not its ink
const MARK = "size-[1em] flex-none translate-y-[0.167em]";

const AegisMark = (props: { matched: boolean }) => (
  <svg class={MARK} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <Show
      when={props.matched}
      fallback={
        <path
          d="M5 5l14 14M19 5L5 19"
          stroke="currentColor"
          stroke-width="1.75"
        />
      }
    >
      <path d="M4 13l5 7L20 4" stroke="currentColor" stroke-width="1.75" />
    </Show>
  </svg>
);

/** A sheet's letter grade, on its tier color */
export const RollTier = (props: { tier: string }) => (
  <span
    class={`tier-${props.tier.toLowerCase()} flex-none bg-(--tier) px-1.5 text-xs font-bold text-black`}
  >
    {props.tier}
  </span>
);

/** The label column beside a verdict, like Perk 1 */
export const VERDICT_ROW =
  "grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-x-2";

const listed = (names: string[]): string => {
  if (names.length < 3) {
    return names.join(" or ");
  }

  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
};

interface Judged {
  mode: Mode;
  read: Assessment;
}

interface MergedOption {
  name: string;
  plugged: boolean;
  wantedBy: Mode[];
}

interface MergedRow {
  label: string;
  matched: boolean;
  judges: number;
  options: MergedOption[];
  wants: { mode: Mode; also: boolean; names: string[] }[];
}

const mergeRows = (judged: Judged[]): MergedRow[] => {
  const perkColumns = Math.max(
    ...judged.map((entry) => entry.read.slots.length),
  );
  const groups: { label: string; verdicts: (SlotVerdict | undefined)[] }[] = [];

  for (let index = 0; index < perkColumns; index += 1) {
    groups.push({
      label: `Perk ${index + 1}`,
      verdicts: judged.map((entry) => entry.read.slots[index]),
    });
  }

  return groups.map((group) => {
    const options: MergedOption[] = [];

    for (const [index, verdict] of group.verdicts.entries()) {
      for (const option of verdict?.options ?? []) {
        let merged = options.find((existing) => existing.name === option.name);

        if (!merged) {
          merged = { name: option.name, plugged: false, wantedBy: [] };
          options.push(merged);
        }

        const mode = judged[index]!.mode;

        merged.plugged = merged.plugged || option.plugged;

        if (option.wanted && !merged.wantedBy.includes(mode)) {
          merged.wantedBy.push(mode);
        }
      }
    }

    return {
      label: group.label,
      matched: group.verdicts.some((verdict) => !!verdict?.matched),
      judges: group.verdicts.filter((verdict) => verdict !== undefined).length,
      options,
      wants: group.verdicts.flatMap((verdict, index) =>
        verdict && unrolled(verdict).length > 0
          ? [
              {
                mode: judged[index]!.mode,
                also: verdict.matched,
                names: unrolled(verdict),
              },
            ]
          : [],
      ),
    };
  });
};

/** Each sheet's standing on the weapon, this roll's perk columns, and the tier they come to */
export const AegisNote = (props: { item: DimItem }) => {
  const judged = createMemo((): Judged[] =>
    shownModes().flatMap((mode) => {
      const read = assess(props.item, mode);

      return read ? [{ mode, read }] : [];
    }),
  );
  const rows = createMemo(() => mergeRows(judged()));
  const paired = () => judged().length > 1;
  const uninstanced = () => props.item.id === "0";
  const options = (row: MergedRow) =>
    uninstanced()
      ? row.options.filter((option) => option.wantedBy.length > 0)
      : row.options;
  const scored = () => judged().filter((entry) => entry.read.slots.length > 0);

  return (
    <Show when={judged().length > 0}>
      <div class="flex flex-col gap-2">
        <For each={judged()}>
          {(entry) => (
            <p class="flex items-baseline gap-2">
              <Show when={entry.read.rating.tier}>
                {(tier) => <RollTier tier={tier()} />}
              </Show>
              <span>
                <span class="mr-1.5 text-xs text-muted-foreground">
                  {MODE_NAMES[entry.mode]}
                </span>
                <b class="font-medium text-foreground">
                  {recommendedBase(entry.read.rating.tier)
                    ? "Recommended base"
                    : "Not a recommended base"}
                </b>
                <Show when={entry.read.rating.rank}>
                  {(rank) => (
                    <span class="text-muted-foreground">
                      {" "}
                      #{rank()} of {entry.read.rating.ranked}{" "}
                      {entry.read.rating.category}
                    </span>
                  )}
                </Show>
                <Show when={entry.read.rating.notes}>
                  {(notes) => (
                    <span class="block text-xs text-muted-foreground">
                      {sentence(notes())}
                    </span>
                  )}
                </Show>
              </span>
            </p>
          )}
        </For>

        <Show when={rows().length > 0}>
          <ul class="flex flex-col gap-1.5 text-xs">
            <For each={rows()}>
              {(row) => (
                <li class={VERDICT_ROW}>
                  <span
                    classList={{
                      "text-good": row.matched,
                      "text-destructive": !row.matched,
                    }}
                  >
                    {row.label}
                  </span>
                  <span class="sr-only">
                    {row.matched ? "recommended" : "not recommended"}
                  </span>
                  <Show
                    when={options(row).length > 0}
                    fallback={
                      <Show when={!uninstanced() || row.wants.length === 0}>
                        <span class="col-start-2 flex items-baseline gap-1.5 text-muted-foreground">
                          <AegisMark matched={false} />
                          {uninstanced() ? "No pick" : "Empty"}
                        </span>
                      </Show>
                    }
                  >
                    <span class="col-start-2 flex flex-col gap-0.5">
                      <For each={options(row)}>
                        {(option) => (
                          <span
                            class="flex items-baseline gap-1.5"
                            classList={{
                              "text-good": option.wantedBy.length > 0,
                              "text-muted-foreground":
                                option.wantedBy.length === 0,
                            }}
                          >
                            <OptionMark option={option} judges={row.judges} />
                            {option.name}
                            <Show when={option.plugged}>
                              <span class="text-muted-foreground">
                                Selected
                              </span>
                            </Show>
                          </span>
                        )}
                      </For>
                    </span>
                  </Show>
                  <For each={row.wants}>
                    {(want) => (
                      <span class="col-start-2 text-muted-foreground">
                        <span class="text-foreground/70">
                          {paired() ? `${MODE_NAMES[want.mode]} ` : ""}
                          {want.also ? "Also wants" : "Wants"}
                        </span>{" "}
                        {listed(want.names)}
                      </span>
                    )}
                  </For>
                </li>
              )}
            </For>
          </ul>

          <Show when={!uninstanced() && scored().length > 0}>
            <p class={`${VERDICT_ROW} border-t pt-1.5 text-xs`}>
              <span class="text-muted-foreground">Overall</span>
              <span class="flex flex-wrap gap-x-4">
                <For each={scored()}>
                  {(entry) => (
                    <span class="flex items-baseline gap-2">
                      <Show when={entry.read.overall}>
                        {(tier) => <RollTier tier={tier()} />}
                      </Show>
                      <Show when={paired()}>
                        <span class="text-muted-foreground">
                          {MODE_NAMES[entry.mode]}
                        </span>
                      </Show>
                    </span>
                  )}
                </For>
              </span>
            </p>
          </Show>
        </Show>
      </div>
    </Show>
  );
};
