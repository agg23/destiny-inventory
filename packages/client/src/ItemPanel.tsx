import type {
  DimItem,
  DimPlug,
  DimSocket,
  DimSocketCategory,
  DimSockets,
  DimStat,
} from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  getArmorArchetypeSocket,
  getSocketsByIndexes,
  isEnhancedPerk,
  socketContainsIntrinsicPlug,
} from "app/utils/socket-utils";
import type { DestinyObjectiveProgress } from "bungie-api-ts/destiny2";
import ammoHeavy from "destiny-icons/general/ammo-heavy.svg?inline";
import ammoPrimary from "destiny-icons/general/ammo-primary.svg?inline";
import ammoSpecial from "destiny-icons/general/ammo-special.svg?inline";
import crucibleGlyph from "destiny-icons/factions/faction_crucible.svg?inline";
import vanguardGlyph from "destiny-icons/factions/faction_vanguard.svg?inline";
import { A } from "@solidjs/router";
import { createMemo, For, Show, type JSX } from "solid-js";

import { BUNGIE } from "./bungie.ts";
import type { Catalyst } from "./collections.ts";
import { delta, TOTAL, type Delta } from "./compare.ts";
import { defs } from "./defs.ts";
import { guest } from "./guest.ts";
import { commonTag, tagDefs } from "./tags.ts";
import { requestTag } from "./tagConfirm.ts";
import {
  defaultEquip,
  defaultTransfer,
  equipTargets,
  pullBlocked,
  storeLabel,
  transferBlocked,
  transferTargets,
} from "./moveTargets.ts";
import { dismissPerk, previewPerk } from "./perkPreview.ts";
import {
  archetype,
  benefits,
  catalysts,
  intrinsics,
  isIntrinsicPlug,
  setBonus,
  type CatalystState,
  type StatChange,
} from "./perks.ts";
import {
  assess,
  MODE_NAMES,
  perkFor,
  setBonusFor,
  setBonusesRanked,
  type Assessment,
  type Mode,
  type SlotVerdict,
} from "./rolls.ts";
import { shownModes } from "./settings.ts";
import { shortStat } from "./statNames.ts";
import { cn } from "./ui/cn.ts";
import { CollectionsGlyph } from "./ui/CollectionsGlyph.tsx";
import { ExternalGlyph } from "./ui/ExternalGlyph.tsx";
import { Objective } from "./ui/Progress.tsx";
import { SplitButton, type Choice } from "./ui/SplitButton.tsx";
import { LABEL } from "./ui/text.ts";
import { Badge } from "./ui/zaidan/badge.tsx";
import { Button } from "./ui/zaidan/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/zaidan/dropdown-menu.tsx";
import { entryHref, lightGgHref } from "./url.ts";

// SocketCategoryHashes for weapon, armor and ghost cosmetics
const COSMETIC = new Set([2048875504, 1926152773, 2549160099]);

// SocketCategoryHashes.IntrinsicTraits
const INTRINSIC_TRAITS = 3956125808;

export interface MoveProps {
  item: DimItem;
  stores: DimStore[];
  active: DimStore | undefined;
  onMove: (target: DimStore, equip: boolean) => void;
  onPrefer: (target: DimStore) => void;
  moving: string | undefined;
  compact?: boolean;
}

export const Moves = (props: MoveProps) => {
  const transfers = () =>
    transferTargets(props.item, props.stores, props.active);
  const equips = () => equipTargets(props.item, props.stores, props.active);

  const transferTo = () =>
    defaultTransfer(props.item, props.stores, props.active);
  const equipOn = () => defaultEquip(props.item, props.stores, props.active);

  const blocked = (target: DimStore) =>
    transferBlocked(props.item, props.stores, target);

  const act = (target: DimStore, equip: boolean, manual: boolean) => {
    if (manual && !target.isVault) {
      props.onPrefer(target);
    }

    props.onMove(target, equip);
  };

  const choices = (targets: DimStore[], equip: boolean): Choice[] =>
    targets.map((store) => ({
      id: store.id,
      label: storeLabel(store),
      reason: equip ? pullBlocked(props.item) : blocked(store),
      onChoose: () => act(store, equip, true),
    }));

  return (
    <Show when={!guest()}>
      <div class="flex flex-col items-stretch gap-2">
        <Show when={transferTo()}>
          {(target) => (
            <SplitButton
              block
              size="sm"
              label={
                props.compact
                  ? "Transfer"
                  : `Transfer to ${storeLabel(target())}`
              }
              disabled={!!props.moving || !!blocked(target())}
              title={blocked(target())}
              onPrimary={() => act(target(), false, false)}
              choices={choices(transfers(), false)}
            />
          )}
        </Show>
        <Show when={equipOn()}>
          {(target) => (
            <SplitButton
              block
              size="sm"
              label={
                props.compact ? "Equip" : `Equip on ${storeLabel(target())}`
              }
              disabled={!!props.moving || !!pullBlocked(props.item)}
              title={pullBlocked(props.item)}
              onPrimary={() => act(target(), true, false)}
              choices={choices(equips(), true)}
            />
          )}
        </Show>
        <Show when={props.moving}>
          {(status) => <p class="text-xs text-muted-foreground">{status()}</p>}
        </Show>
      </div>
    </Show>
  );
};

export const StatDelta = (props: { delta: Delta | undefined }) => (
  <Show when={props.delta}>
    {(change) => (
      <span
        class="text-xs whitespace-nowrap tabular-nums"
        classList={{
          "text-good": change().better,
          "text-destructive": !change().better,
        }}
      >
        {change().value > 0 ? "+" : "−"}
        {Math.abs(change().value)}
      </span>
    )}
  </Show>
);

/** Extra classes for the stat list's total row */
export const TOTAL_ROW = "mt-0.5 border-t pt-1";

export const STAT_NAME = "text-right text-xs text-muted-foreground";

export const StatValue = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
  total?: boolean;
  best?: boolean;
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
}) => {
  const fraction = () =>
    props.stat.maximumValue > 0
      ? Math.min(1, Math.abs(props.stat.value) / props.stat.maximumValue)
      : 0;

  return (
    <Show when={props.stat.bar}>
      <span
        class="block h-1.5 overflow-hidden rounded-full bg-muted"
        classList={{ [TOTAL_ROW]: props.total }}
      >
        <span
          class="block h-full"
          classList={{
            "bg-light": props.masterworked,
            "bg-foreground": !props.masterworked,
          }}
          style={{ width: `${fraction() * 100}%` }}
        />
      </span>
    </Show>
  );
};

export const Bar = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
  masterworked?: boolean;
}) => {
  const total = () => props.stat.statHash === TOTAL;

  return (
    <>
      <span class={STAT_NAME} classList={{ [TOTAL_ROW]: total() }}>
        {shortStat(props.stat.displayProperties.name)}
      </span>
      <StatBar
        stat={props.stat}
        total={total()}
        masterworked={props.masterworked}
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

const identity = (plug: DimPlug): string => {
  const { name, icon } = plug.plugDef.displayProperties;

  return `${name}|${icon}`;
};

// The game lights the plugged perk and dims the rest
const plugClass = (
  socket: DimSocket,
  plug: DimPlug,
  available: boolean,
): string => {
  const plugged = plug.plugDef.hash === socket.plugged?.plugDef.hash;
  const enhanced = isEnhancedPerk(plug.plugDef);

  return cn(
    "size-(--plug) flex-none ring-inset",
    socket.isPerk && !socketContainsIntrinsicPlug(socket) && "rounded-full",
    plugged ? "bg-muted" : "bg-foreground/5",
    !plugged && !plug.enabled && "opacity-25",
    !plugged && plug.enabled && (available ? "opacity-75" : "opacity-45"),
    enhanced ? "ring-light" : plugged ? "ring-input" : "ring-border",
    enhanced && plugged ? "ring-2" : "ring-1",
  );
};

const Socket = (props: {
  item: DimItem;
  socket: DimSocket;
  all?: boolean;
}) => {
  // Enhanced variants roll under their own hash, so match the way the pool dedupes
  const onInstance = () =>
    new Map(props.socket.plugOptions.map((plug) => [identity(plug), plug]));

  const pool = () => {
    const set = props.socket.plugSet;

    if (!props.all || !props.socket.isPerk || !set) {
      return undefined;
    }

    const rollable = new Set(set.plugHashesThatCanRoll);
    const canRoll =
      rollable.size > 0
        ? set.plugs.filter((plug) => rollable.has(plug.plugDef.hash))
        : set.plugs;

    // Bungie lists enhanced variants as their own plugs
    const plugged = props.socket.plugged;
    const seen = new Set<string>();

    if (plugged) {
      seen.add(identity(plugged));
    }

    const rest = canRoll.flatMap((plug) => {
      const key = identity(plug);

      if (isEnhancedPerk(plug.plugDef) || seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [plug];
    });

    const carried = onInstance();

    // The pool holds the base variant, so swap in the one the item carries
    const sorted = [
      ...rest.flatMap((plug) => {
        const own = carried.get(identity(plug));

        return own ? [own] : [];
      }),
      ...rest.filter((plug) => !carried.has(identity(plug))),
    ];

    return plugged ? [plugged, ...sorted] : sorted;
  };

  const options = () => {
    const all = pool();

    if (all && all.length > 0) {
      return all;
    }

    if (props.socket.plugOptions.length > 0) {
      return props.socket.plugOptions;
    }

    return props.socket.plugged ? [props.socket.plugged] : [];
  };

  return (
    <div class="flex flex-col gap-1">
      <For each={options()}>
        {(plug) => (
          <span
            class="relative inline-flex"
            onMouseEnter={(event) =>
              previewPerk(props.item, plug, event.currentTarget)
            }
            onMouseLeave={() => dismissPerk(plug)}
          >
            <img
              class={plugClass(
                props.socket,
                plug,
                onInstance().has(identity(plug)),
              )}
              src={`${BUNGIE}${plug.plugDef.displayProperties.icon}`}
              loading="lazy"
              alt=""
            />
            <Show when={perkFor(plug.plugDef.hash)?.rank}>
              {(rank) => (
                <span class="absolute -right-px -bottom-px min-w-3 bg-popover px-px text-center text-[10px] leading-tight tabular-nums">
                  {rank()}
                </span>
              )}
            </Show>
          </span>
        )}
      </For>
    </div>
  );
};

const Category = (props: {
  item: DimItem;
  sockets: DimSockets;
  category: DimSocketCategory;
  all?: boolean;
  onlyPlugged?: boolean;
  onToggleAll?: () => void;
}) => {
  // Year one armor perk sockets hold nameless placeholders
  const blank = (socket: DimSocket) =>
    [socket.plugged, ...socket.plugOptions].every(
      (plug) => !plug?.plugDef.displayProperties?.icon,
    );

  const sockets = () =>
    getSocketsByIndexes(props.sockets, props.category.socketIndexes).filter(
      (socket) =>
        !blank(socket) &&
        !isIntrinsicPlug(socket.plugged) &&
        (props.onlyPlugged
          ? socket.plugged
          : socket.plugged ?? socket.plugOptions.length > 0),
    );

  const rollable = () =>
    sockets().some(
      (socket) => socket.isPerk && (socket.plugSet?.plugs.length ?? 0) > 1,
    );

  return (
    <Show when={sockets().length > 0}>
      <div>
        <h4 class={`${LABEL} mt-3 mb-1.5 flex h-6 items-center justify-between`}>
          {/* Bungie writes these in capitals */}
          {sentence(props.category.category.displayProperties.name.toLowerCase())}
          <Show when={props.onToggleAll && rollable()}>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              class="w-12"
              aria-pressed={Boolean(props.all)}
              onClick={props.onToggleAll}
            >
              {props.all ? "Hide" : "All"}
            </Button>
          </Show>
        </h4>
        <div class="flex flex-wrap items-start gap-1">
          <For each={sockets()}>
            {(socket) => (
              <Socket item={props.item} socket={socket} all={props.all} />
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};

export const Perks = (props: {
  item: DimItem;
  all?: boolean;
  onlyPlugged?: boolean;
  onToggleAll?: () => void;
}) => {
  const shown = () => {
    const archetypeSocket = getArmorArchetypeSocket(props.item);
    const categories = (props.item.sockets?.categories ?? []).filter(
      (category) =>
        !COSMETIC.has(category.category.hash) &&
        category.category.hash !== INTRINSIC_TRAITS,
    );

    if (!archetypeSocket) {
      return categories;
    }

    return categories.filter(
      (category) =>
        !category.socketIndexes.includes(archetypeSocket.socketIndex),
    );
  };

  return (
    <Show when={props.item.sockets}>
      {(sockets) => (
        <For each={shown()}>
          {(category) => (
            <Category
              item={props.item}
              sockets={sockets()}
              category={category}
              all={props.all}
              onlyPlugged={props.onlyPlugged}
              onToggleAll={props.onToggleAll}
            />
          )}
        </For>
      )}
    </Show>
  );
};

const perkIconClass = (enhanced?: boolean, square?: boolean): string =>
  square
    ? "size-8 flex-none"
    : `size-8 flex-none rounded-full border bg-foreground/8 ${
        enhanced ? "border-light" : "border-foreground/50"
      }`;

export const PerkIcon = (props: {
  icon: string | undefined;
  enhanced?: boolean;
  square?: boolean;
}) => (
  <Show
    when={props.icon}
    fallback={<span class={perkIconClass(props.enhanced, props.square)} />}
  >
    {(icon) => (
      <img
        class={perkIconClass(props.enhanced, props.square)}
        src={`${BUNGIE}${icon()}`}
        alt=""
        loading="lazy"
      />
    )}
  </Show>
);

/** An icon beside a perk's name and description */
export const PERK = "flex items-start gap-3 py-1.5";

export const PERK_NAME = "block font-medium text-foreground";

/** A perk name followed by badges */
export const PERK_TITLE =
  "flex flex-wrap items-center gap-1.5 font-medium text-foreground";

export const PERK_TEXT = "block text-xs whitespace-pre-wrap text-muted-foreground";

/** Light gold, for Enhanced and other game-marked states */
export const GOLD_BADGE = "border-light/40 text-light";

export const Archetype = (props: { item: DimItem }) => {
  const found = createMemo(() => archetype(props.item));

  return (
    <Show when={found()}>
      {(plug) => (
        <div class={`${PERK} items-center!`} title={plug().description}>
          <PerkIcon icon={plug().icon} />
          <b class={PERK_NAME}>{plug().name}</b>
        </div>
      )}
    </Show>
  );
};

const Intrinsics = (props: { item: DimItem }) => {
  const list = createMemo(() => intrinsics(props.item));

  return (
    <For each={list()}>
      {(intrinsic) => (
        <div class={PERK}>
          <PerkIcon icon={intrinsic.icon} square />
          <div class="min-w-0">
            <b class={PERK_NAME}>{intrinsic.name}</b>
            <Changes stats={intrinsic.stats} />
            <Show when={intrinsic.description}>
              <span class={PERK_TEXT}>
                {intrinsic.description}
              </span>
            </Show>
          </div>
        </div>
      )}
    </For>
  );
};

const STATE_LABELS: Record<CatalystState, string> = {
  missing: "Missing",
  obtained: "Obtained",
  complete: "Complete",
};

const Objectives = (props: { objectives: DestinyObjectiveProgress[] }) => (
  <ul class="mt-1.5 flex max-w-105 flex-col gap-1.5 text-xs">
    <For each={props.objectives}>
      {(objective) => (
        <li>
          <Objective
            label={
              defs()?.Objective.getOptional(objective.objectiveHash)
                ?.progressDescription ?? ""
            }
            progress={objective.progress ?? 0}
            goal={objective.completionValue}
          />
        </li>
      )}
    </For>
  </ul>
);

const Catalysts = (props: { item: DimItem; account?: Catalyst }) => {
  const list = createMemo(() => catalysts(props.item, props.account));

  return (
    <Show when={list().length > 0}>
      <div>
        <h4 class={`${LABEL} mt-3 mb-1.5`}>
          {list().length > 1 ? "Catalysts" : "Catalyst"}
        </h4>
        <For each={list()}>
          {(catalyst) => (
            <div class={PERK}>
              <PerkIcon icon={catalyst.icon} square />
              <div class="min-w-0">
                <b class={PERK_TITLE}>
                  {catalyst.name}
                  <Show when={catalyst.state}>
                    {(state) => (
                      <Badge
                        variant="outline"
                        class={
                          state() === "missing"
                            ? "text-muted-foreground"
                            : GOLD_BADGE
                        }
                      >
                        {STATE_LABELS[state()]}
                      </Badge>
                    )}
                  </Show>
                  <Show when={catalyst.inserted}>
                    <Badge variant="outline" class={GOLD_BADGE}>
                      Inserted
                    </Badge>
                  </Show>
                </b>
                <Changes stats={catalyst.stats} />
                <For each={catalyst.lines}>
                  {(line) => (
                    <span class={PERK_TEXT}>
                      <Show when={line.name}>
                        {(name) => <span class="text-light">{name()}: </span>}
                      </Show>
                      {line.description}
                    </span>
                  )}
                </For>
                <Show
                  when={
                    catalyst.state === "obtained" &&
                    catalyst.objectives.length > 0
                  }
                >
                  <Objectives objectives={catalyst.objectives} />
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

const masterworkHashes = (item: DimItem): Set<number> =>
  new Set(
    (item.masterworkInfo?.stats ?? [])
      .filter((stat) => stat.isPrimary)
      .map((stat) => stat.hash),
  );

const Masterwork = (props: { item: DimItem }) => {
  const primary = () =>
    (props.item.masterworkInfo?.stats ?? []).filter(
      (stat) => stat.isPrimary && stat.name && stat.value > 0,
    );

  const tier = () => props.item.masterworkInfo?.tier;

  // Unmasterworked armor still carries a masterworkInfo at tier 0
  const worth = () =>
    props.item.masterwork || !!tier() || primary().length > 0;

  return (
    <Show when={worth()}>
      <p
        class="m-0 text-xs"
        classList={{
          "text-light": props.item.masterwork,
          "text-muted-foreground": !props.item.masterwork,
        }}
      >
        <b class="font-medium">Masterwork</b>
        <Show when={tier()}>{(level) => <> {level()}</>}</Show>
        <For each={primary()}>
          {(stat) => (
            <>
              {" "}
              · {stat.name} +{stat.value}
            </>
          )}
        </For>
      </p>
    </Show>
  );
};

export const Stats = (props: { item: DimItem; against?: DimItem }) => {
  const sorted = () =>
    [...(props.item.stats ?? [])].sort((a, b) => a.sort - b.sort);

  const theirs = (hash: number) =>
    props.against?.stats?.find((stat) => stat.statHash === hash);

  const boosted = createMemo(() => masterworkHashes(props.item));

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
            />
          )}
        </For>
      </div>
    </Show>
  );
};

// Set effects live on the sandbox perks
export const SetBonus = (props: { item: DimItem }) => {
  const bonus = createMemo(() => setBonus(props.item));

  return (
    <Show when={bonus()}>
      {(set) => (
        <>
          <h4 class={`${LABEL} mt-3 mb-1.5`}>{set().name}</h4>
          <For each={set().perks}>
            {(perk) => {
              const rated = () =>
                shownModes().flatMap((mode) => {
                  const rating = setBonusFor(perk.hash, mode);

                  return rating ? [{ mode, rating }] : [];
                });

              return (
                <div class={PERK}>
                  <PerkIcon icon={perk.icon} />
                  <div class="min-w-0">
                    <b class={PERK_NAME}>
                      {perk.requiredSetCount} piece · {perk.name}
                    </b>
                    <span class={PERK_TEXT}>{perk.description}</span>
                    <Show when={rated().length > 0}>
                      <div class="mt-1.5 flex flex-col gap-1.5 border-t pt-1.5 text-xs">
                        <For each={rated()}>
                          {(entry) => (
                            <div>
                              <span class="flex items-baseline gap-2">
                                <Show when={entry.rating.tier}>
                                  {(tier) => <RollTier tier={tier()} />}
                                </Show>
                                <span class="text-muted-foreground">
                                  {MODE_NAMES[entry.mode]}
                                </span>
                                <Show when={entry.rating.rank}>
                                  {(rank) => (
                                    <span class="text-muted-foreground">
                                      #{rank()} of{" "}
                                      {setBonusesRanked(entry.mode)}
                                    </span>
                                  )}
                                </Show>
                              </span>
                              <Show when={entry.rating.notes}>
                                {(notes) => (
                                  <span class="block text-muted-foreground">
                                    {sentence(notes())}
                                  </span>
                                )}
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </>
      )}
    </Show>
  );
};

export const Changes = (props: { stats: StatChange[] }) => (
  <Show when={props.stats.length > 0}>
    <div class="flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5">
      <For each={props.stats}>
        {(stat) => (
          <span
            class="text-xs whitespace-nowrap tabular-nums"
            classList={{
              "text-good": stat.better,
              "text-destructive": !stat.better,
            }}
          >
            {stat.value > 0 ? "+" : "−"}
            {Math.abs(stat.value)} {stat.name}
          </span>
        )}
      </For>
    </div>
  </Show>
);

export const Benefits = (props: { item: DimItem }) => {
  const list = createMemo(() => benefits(props.item));

  return (
    <Show when={list().length > 0}>
      <For each={list()}>
        {(benefit) => (
          <div class={PERK}>
            <PerkIcon
              icon={benefit.icon}
              enhanced={benefit.enhanced}
              square={benefit.intrinsic}
            />
            <div class="min-w-0">
              <b
                class={PERK_TITLE}
                classList={{ "text-light!": benefit.enhanced }}
              >
                {benefit.name}
                <Show when={benefit.enhanced}>
                  <Badge variant="outline" class={GOLD_BADGE}>
                    Enhanced
                  </Badge>
                </Show>
                <Show when={benefit.intrinsic}>
                  <Badge variant="outline" class={GOLD_BADGE}>
                    Intrinsic
                  </Badge>
                </Show>
              </b>
              <Changes stats={benefit.stats} />
              <Show when={benefit.description}>
                <span class={PERK_TEXT}>
                  {benefit.description}
                </span>
              </Show>
            </div>
          </div>
        )}
      </For>
    </Show>
  );
};

// DestinyClass Titan, Hunter and Warlock
const CLASSES = new Set([0, 1, 2]);

// "Helmet" alone does not say which class
export const typeName = (item: DimItem): string => {
  const owner = item.classTypeNameLocalized;

  if (!CLASSES.has(item.classType) || item.typeName.startsWith(owner)) {
    return item.typeName;
  }

  return `${owner} ${item.typeName}`;
};

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

const OptionMark = (props: { option: MergedOption; judges: number }) => (
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

// The sheet writes the notes lowercase
const sentence = (text: string): string =>
  text.replace(/\p{L}/u, (first) => first.toUpperCase());

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

export const ItemHead = (props: {
  item: DimItem;
  compact?: boolean;
  taggable?: boolean;
  /** Collections and light.gg links */
  links?: boolean;
  notes?: string[];
}) => (
  <>
    <div
      class={`tooltip-header ${props.item.rarity.toLowerCase()}`}
      classList={{ "h-(--item-head) p-0": props.compact }}
    >
      <div class="flex h-full items-stretch gap-2">
        <Show when={props.compact}>
          <img
            class="aspect-square h-full shrink-0"
            src={`${BUNGIE}${props.item.icon}`}
            alt=""
          />
        </Show>
        <div
          class="min-w-0 flex-1"
          classList={{ "flex flex-col justify-center pr-4": props.compact }}
        >
          <div
            class="tooltip-name"
            classList={{
              "line-clamp-2 pr-6 text-sm leading-5 whitespace-normal":
                props.compact,
            }}
          >
            {props.item.name}
          </div>
          <div class="tooltip-type">
            <span class="truncate">{typeName(props.item)}</span>
            <Show when={props.item.tier > 0}>
              <span class="gear-tier">Tier {props.item.tier}</span>
            </Show>
          </div>
        </div>
      </div>
    </div>
    <div
      class="py-2 empty:hidden"
      classList={{
        "tooltip-body": !props.compact,
        "border-b": props.compact,
      }}
    >
      <ItemPower
        item={props.item}
        taggable={props.taggable}
        links={props.links}
        notes={props.notes}
      />
    </div>
  </>
);

// DestinyAmmunitionType Primary, Special and Heavy
const AMMO: Record<number, { url: string; name: string }> = {
  1: { url: ammoPrimary, name: "Primary" },
  2: { url: ammoSpecial, name: "Special" },
  3: { url: ammoHeavy, name: "Heavy" },
};

/** The tag dropdown, setting one tag across every item it is given */
export const TagControl = (props: { items: DimItem[] }) => {
  const shared = () => commonTag(props.items);
  const current = () => {
    const tag = shared();

    return tag === "mixed" ? undefined : tag;
  };
  const label = () =>
    shared() === "mixed" ? "Mixed" : (current()?.label ?? "No tag");
  const tint = () => `var(--${current()?.color ?? "line-bright"})`;

  const apply = (tagId: string | undefined) => requestTag(props.items, tagId);

  return (
    <DropdownMenu placement="bottom-end" modal={false} preventScroll={false}>
      <DropdownMenuTrigger
        class="tag-control"
        classList={{ tagged: !!current() }}
        style={{ "--tag": tint() }}
        aria-label={current() ? `Tag: ${current()!.label}` : label()}
        title={label()}
      >
        {label()}
      </DropdownMenuTrigger>
      <DropdownMenuContent data-menu="tag" class="min-w-32">
        <DropdownMenuItem
          onSelect={() => apply(undefined)}
        >
          <span class="size-2 rounded-full border border-dashed border-input" />
          No tag
        </DropdownMenuItem>
        <For each={tagDefs()}>
          {(def) => (
            <DropdownMenuItem
              onSelect={() => apply(def.id)}
            >
              <span
                class="size-2 rounded-full"
                style={{ "background-color": `var(--color-${def.color})` }}
              />
              {def.label}
            </DropdownMenuItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ItemLinks = (props: { item: DimItem }) => (
  <span class="item-links">
    <A
      href={entryHref(props.item.hash, {
        kind: props.item.bucket.inArmor ? "armor" : "weapon",
      })}
      title="Show in collections"
      aria-label="Show in collections"
    >
      <CollectionsGlyph />
    </A>
    <a
      href={lightGgHref(props.item.hash)}
      target="_blank"
      rel="noreferrer"
      title="Show on light.gg"
      aria-label="Show on light.gg"
    >
      <ExternalGlyph />
    </a>
  </span>
);

export const ItemPower = (props: {
  item: DimItem;
  taggable?: boolean;
  links?: boolean;
  notes?: string[];
}) => {
  const armor = () => props.item.bucket.inArmor;
  const notes = () => props.notes ?? [];
  const linked = () =>
    !!props.links && (props.item.bucket.inWeapons || armor());

  return (
    <Show
      when={
        props.item.power > 0 ||
        props.item.element ||
        props.item.energy ||
        props.item.breakerType ||
        linked() ||
        (props.taggable && props.item.id !== "0") ||
        notes().length > 0
      }
    >
      <div class="tooltip-power">
        <span class="power-facts">
          <Show when={props.item.power > 0}>
            <span class="power-value">{props.item.power}</span>
          </Show>
          <Show when={!armor() && AMMO[props.item.ammoType]}>
            {(ammo) => (
              <img
                class="ammo-icon"
                src={ammo().url}
                alt=""
                title={ammo().name}
              />
            )}
          </Show>
          <Show when={!armor() && props.item.element?.displayProperties.icon}>
            {(icon) => (
              <img
                class="element-icon"
                src={`${BUNGIE}${icon()}`}
                alt=""
                title={props.item.element?.displayProperties.name}
              />
            )}
          </Show>
          <Show when={props.item.breakerType?.displayProperties.icon}>
            {(icon) => (
              <img
                class="breaker-icon"
                src={`${BUNGIE}${icon()}`}
                alt=""
                title={props.item.breakerType?.displayProperties.name}
              />
            )}
          </Show>
          <Show when={armor() && props.item.energy}>
            {(energy) => (
              <span class="power-type">
                Energy {energy().energyUsed}/{energy().energyCapacity}
              </span>
            )}
          </Show>
        </span>
        <Show when={linked()}>
          <ItemLinks item={props.item} />
        </Show>
        <Show when={props.taggable && props.item.id !== "0"}>
          <TagControl items={[props.item]} />
        </Show>
        <Show when={notes().length > 0}>
          <span class="power-notes">{notes().join(" · ")}</span>
        </Show>
      </div>
    </Show>
  );
};
