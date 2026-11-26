import type { DimItem, DimStat } from "app/inventory/item-types";
import { getArmor3TuningStat } from "app/utils/item-utils";
import { createMemo, For, Show, type JSX } from "solid-js";

import { delta, TOTAL, type Delta } from "../../core/items/compare.ts";
import type { StatChange } from "../../core/items/perks.ts";
import { shortStat } from "../../core/items/statNames.ts";
import { TuningGlyph } from "../lib/TuningGlyph.tsx";

const Signed = (props: {
  value: number;
  better: boolean;
  children?: JSX.Element;
}) => (
  <span
    class="text-xs whitespace-nowrap tabular-nums"
    classList={{
      "text-good": props.better,
      "text-destructive": !props.better,
    }}
  >
    {props.value > 0 ? "+" : "−"}
    {Math.abs(props.value)}
    {props.children}
  </span>
);

const StatDelta = (props: { delta: Delta | undefined }) => (
  <Show when={props.delta}>
    {(change) => <Signed value={change().value} better={change().better} />}
  </Show>
);

/** Extra classes for the stat list's total row */
export const TOTAL_ROW = "mt-0.5 border-t pt-1";

export const STAT_NAME = "text-right text-xs text-muted-foreground";

/** Marks the stat an armor piece's tuning slot moves */
export const Tuned = (props: { when: boolean }) => (
  <Show when={props.when}>
    <TuningGlyph class="mr-1 inline-block size-3 align-[-0.125em]" />
  </Show>
);

export const StatValue = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
  total?: boolean;
  best?: boolean;
  tuned?: boolean;
}) => (
  <span
    class="flex min-w-[2ch] gap-1 text-xs tabular-nums"
    classList={{
      [TOTAL_ROW]: props.total,
      "text-cream": props.best,
      "text-foreground": !props.best,
      // Rounds per minute has no bar
      "col-span-2 justify-start": !props.stat.bar,
      "justify-end": Boolean(props.stat.bar),
    }}
  >
    <Show when={props.tuned}>
      <TuningGlyph class="size-3 self-center text-muted-foreground" />
    </Show>
    <span>{props.stat.value}</span>
    <Show when={props.comparing}>
      <StatDelta delta={delta(props.stat, props.against)} />
    </Show>
  </span>
);

export const StatBar = (props: {
  stat: DimStat;
  total?: boolean;
  masterworked?: boolean;
  base?: boolean;
}) => {
  const fraction = (value: number) =>
    props.stat.maximumValue > 0
      ? Math.min(1, Math.abs(value) / props.stat.maximumValue)
      : 0;

  const valueFraction = () => fraction(props.stat.value);

  // Tuning can pull a stat below its base
  const baseFraction = () =>
    props.base ? Math.min(fraction(props.stat.base), valueFraction()) : 0;

  return (
    <Show when={props.stat.bar}>
      <span
        class="flex h-1.5 overflow-hidden rounded-full bg-muted"
        classList={{ [TOTAL_ROW]: props.total }}
      >
        <span
          class="h-full bg-foreground"
          style={{ width: `${baseFraction() * 100}%` }}
        />
        <span
          class="h-full"
          classList={{
            "bg-light": props.masterworked && !props.base,
            "bg-foreground": !props.masterworked && !props.base,
            "bg-muted-foreground": props.base,
          }}
          style={{ width: `${(valueFraction() - baseFraction()) * 100}%` }}
        />
      </span>
    </Show>
  );
};

const Bar = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
  masterworked?: boolean;
  base: boolean;
  tuned: boolean;
}) => {
  const total = () => props.stat.statHash === TOTAL;

  return (
    <>
      <span class={STAT_NAME} classList={{ [TOTAL_ROW]: total() }}>
        <Tuned when={props.tuned} />
        {shortStat(props.stat.displayProperties.name)}
      </span>
      <StatBar
        stat={props.stat}
        total={total()}
        masterworked={props.masterworked}
        base={props.base}
      />
      <StatValue
        stat={props.stat}
        against={props.against}
        comparing={props.comparing}
        total={total()}
      />
    </>
  );
};

export const masterworkHashes = (item: DimItem): Set<number> =>
  new Set(
    (item.masterworkInfo?.stats ?? [])
      .filter((stat) => stat.isPrimary)
      .map((stat) => stat.hash),
  );

export const Stats = (props: { item: DimItem; against?: DimItem }) => {
  const sorted = () =>
    [...(props.item.stats ?? [])].sort((a, b) => a.sort - b.sort);

  const theirs = (hash: number) =>
    props.against?.stats?.find((stat) => stat.statHash === hash);

  const boosted = createMemo(() => masterworkHashes(props.item));
  const tuned = createMemo(() => getArmor3TuningStat(props.item));

  return (
    <Show when={props.item.stats?.length}>
      <div class="grid grid-cols-[minmax(6rem,max-content)_1fr_max-content] items-center gap-x-2.5 gap-y-1">
        <For each={sorted()}>
          {(stat) => (
            <Bar
              stat={stat}
              against={theirs(stat.statHash)}
              comparing={Boolean(props.against)}
              masterworked={boosted().has(stat.statHash)}
              base={!!props.item.bucket.inArmor}
              tuned={tuned() === stat.statHash}
            />
          )}
        </For>
      </div>
    </Show>
  );
};

export const Changes = (props: { stats: StatChange[] }) => (
  <Show when={props.stats.length > 0}>
    <div class="flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5">
      <For each={props.stats}>
        {(stat) => (
          <Signed value={stat.value} better={stat.better}>
            {" "}
            {stat.name}
          </Signed>
        )}
      </For>
    </div>
  </Show>
);
