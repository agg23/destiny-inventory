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
import {
  amountOfItem,
  getCurrentStore,
  potentialSpaceLeftForItem,
} from "app/inventory/stores-helpers";
import { isClassCompatible, itemCanBeEquippedBy } from "app/utils/item-utils";
import ammoHeavy from "destiny-icons/general/ammo-heavy.svg";
import ammoPrimary from "destiny-icons/general/ammo-primary.svg";
import ammoSpecial from "destiny-icons/general/ammo-special.svg";
import { createMemo, For, Show, type JSX } from "solid-js";

import { BUNGIE } from "./bungie.ts";
import { delta, TOTAL, unmovable, type Delta } from "./compare.ts";
import { archetype, benefits, setBonus, type StatChange } from "./perks.ts";
import {
  assess,
  perkFor,
  perkRanked,
  setBonusFor,
  setBonusesRanked,
  type SlotVerdict,
} from "./rolls.ts";
import { shortStat } from "./statNames.ts";
import { Button } from "./ui/Button.tsx";
import { SplitButton, type Choice } from "./ui/SplitButton.tsx";

// BucketHashes.LostItems, inlined
export const LOST_ITEMS = 215593132;

// SocketCategoryHashes for weapon, armor and ghost cosmetics
const COSMETIC = new Set([2048875504, 1926152773, 2549160099]);

export interface MoveProps {
  item: DimItem;
  stores: DimStore[];
  active: DimStore | undefined;
  onMove: (target: DimStore, equip: boolean) => void;
  onPrefer: (target: DimStore) => void;
  moving: string | undefined;
  compact?: boolean;
}

const label = (store: DimStore) => (store.isVault ? "Vault" : store.className);

export const Moves = (props: MoveProps) => {
  const vault = () => props.stores.find((store) => store.isVault);
  const characters = () => props.stores.filter((store) => !store.isVault);

  const canTransfer = () => !props.item.notransfer;

  const inPostmaster = () => props.item.location.hash === LOST_ITEMS;

  const owner = () =>
    props.stores.find((store) => store.id === props.item.owner);

  const noRoom = (target: DimStore): string | undefined => {
    const item = props.item;
    const space = potentialSpaceLeftForItem(target, item, props.stores);

    if (space.guaranteed > 0) {
      return undefined;
    }

    // Account-wide buckets live on the current character
    const holder =
      item.bucket.accountWide && !target.isVault
        ? getCurrentStore(props.stores)
        : target;

    if (
      item.uniqueStack &&
      holder &&
      amountOfItem(holder, item) >= item.maxStackSize
    ) {
      return `${label(target)} already holds the maximum`;
    }

    return space.couldMakeSpace ? undefined : `No room in ${label(target)}`;
  };

  const pullBlocked = (): string | undefined => {
    if (unmovable(props.item)) {
      return "Cannot be pulled from the Postmaster";
    }

    if (inPostmaster() && !props.item.canPullFromPostmaster) {
      return "Cannot be pulled from the Postmaster";
    }

    return undefined;
  };

  const blocked = (target: DimStore): string | undefined => {
    const item = props.item;
    const pull = pullBlocked();

    if (pull) {
      return pull;
    }

    if (inPostmaster()) {
      return noRoom(target);
    }

    if (item.notransfer) {
      return "Cannot be transferred";
    }

    return noRoom(target);
  };

  const holders = () => {
    const compatible = props.stores.filter(
      (store) =>
        store.isVault ||
        isClassCompatible(props.item.classType, store.classType),
    );

    if (!inPostmaster()) {
      return compatible;
    }

    return compatible.filter(
      (store) => store.isVault || store.id === props.active?.id,
    );
  };

  const transferTargets = () => {
    const elsewhere = holders().filter(
      (store) => store.id !== props.item.owner && canTransfer(),
    );
    const home = owner();

    // A pull lands on the owning character, transferable or not
    if (inPostmaster() && home && home.id === props.active?.id) {
      return [home, ...elsewhere];
    }

    return elsewhere;
  };

  const transferTo = () => {
    const home = owner();

    if (inPostmaster()) {
      return transferTargets()[0];
    }

    if (!home?.isVault) {
      return vault();
    }

    const characters = holders().filter((store) => !store.isVault);

    if (
      props.active &&
      characters.some((store) => store.id === props.active?.id)
    ) {
      return props.active;
    }

    return characters[0];
  };

  const equippable = () => {
    const targets = characters().filter(
      (store) =>
        itemCanBeEquippedBy(props.item, store, true) &&
        !(props.item.equipped && props.item.owner === store.id),
    );

    if (!inPostmaster()) {
      return targets;
    }

    return targets.filter((store) => store.id === props.active?.id);
  };

  const equipOn = () => {
    const targets = equippable();

    if (
      props.active &&
      targets.some((store) => store.id === props.active?.id)
    ) {
      return props.active;
    }

    return targets[0];
  };

  const act = (target: DimStore, equip: boolean, manual: boolean) => {
    if (manual && !target.isVault) {
      props.onPrefer(target);
    }

    props.onMove(target, equip);
  };

  const choices = (targets: DimStore[], equip: boolean): Choice[] =>
    targets.map((store) => ({
      id: store.id,
      label: label(store),
      reason: equip ? pullBlocked() : blocked(store),
      onChoose: () => act(store, equip, true),
    }));

  return (
    <div class="flex flex-col items-stretch gap-1.5">
      <Show when={transferTo()}>
        {(target) => (
          <SplitButton
            block
            size="xs"
            label={
              props.compact ? "Transfer" : `Transfer to ${label(target())}`
            }
            disabled={!!props.moving || !!blocked(target())}
            title={blocked(target())}
            onPrimary={() => act(target(), false, false)}
            choices={choices(transferTargets(), false)}
          />
        )}
      </Show>
      <Show when={equipOn()}>
        {(target) => (
          <SplitButton
            block
            size="xs"
            label={props.compact ? "Equip" : `Equip on ${label(target())}`}
            disabled={!!props.moving || !!pullBlocked()}
            title={pullBlocked()}
            onPrimary={() => act(target(), true, false)}
            choices={choices(equippable(), true)}
          />
        )}
      </Show>
      <Show when={props.moving}>
        {(status) => <p class="text-muted">{status()}</p>}
      </Show>
    </div>
  );
};

export const StatDelta = (props: { delta: Delta | undefined }) => (
  <Show when={props.delta}>
    {(change) => (
      <span
        class="text-xs whitespace-nowrap tabular-nums"
        classList={{
          "text-success": change().better,
          "text-danger": !change().better,
        }}
      >
        {change().value > 0 ? "+" : "−"}
        {Math.abs(change().value)}
      </span>
    )}
  </Show>
);

// The framework's stat list ends in one value cell
export const StatValue = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
  total?: boolean;
  best?: boolean;
}) => (
  <span
    class="stat-value flex gap-1 tabular-nums"
    classList={{
      total: props.total,
      "text-gold": props.best,
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
      <span class="stat-bar" classList={{ total: props.total }}>
        <span
          class="stat-fill"
          classList={{ masterwork: props.masterworked }}
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
      <span class="stat-name" classList={{ total: total() }}>
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
const Socket = (props: { socket: DimSocket; all?: boolean }) => {
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

    return plugged ? [plugged, ...rest] : rest;
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

  const tip = (plug: DimPlug) => {
    const { name, description } = plug.plugDef.displayProperties;
    const graded = perkFor(plug.plugDef.hash);
    const standing = graded?.rank
      ? `Aegis #${graded.rank} of ${perkRanked(graded.kind)}`
      : undefined;

    return [name, standing, description].filter(Boolean).join("\n\n");
  };

  return (
    <div class="flex flex-col gap-1">
      <For each={options()}>
        {(plug) => (
          <span class="plug-slot">
            <img
              class="plug"
              classList={{
                plugged:
                  plug.plugDef.hash === props.socket.plugged?.plugDef.hash,
                disabled: !plug.enabled,
                round:
                  props.socket.isPerk &&
                  !socketContainsIntrinsicPlug(props.socket),
                enhanced: isEnhancedPerk(plug.plugDef),
              }}
              src={`${BUNGIE}${plug.plugDef.displayProperties.icon}`}
              loading="lazy"
              alt={plug.plugDef.displayProperties.name}
              title={tip(plug)}
            />
            <Show when={perkFor(plug.plugDef.hash)?.rank}>
              {(rank) => <span class="plug-rank">{rank()}</span>}
            </Show>
          </span>
        )}
      </For>
    </div>
  );
};

const Category = (props: {
  sockets: DimSockets;
  category: DimSocketCategory;
  all?: boolean;
  onlyPlugged?: boolean;
  onToggleAll?: () => void;
}) => {
  const sockets = () =>
    getSocketsByIndexes(props.sockets, props.category.socketIndexes).filter(
      (socket) =>
        props.onlyPlugged
          ? socket.plugged
          : socket.plugged ?? socket.plugOptions.length > 0,
    );

  const rollable = () =>
    sockets().some(
      (socket) => socket.isPerk && (socket.plugSet?.plugs.length ?? 0) > 1,
    );

  return (
    <Show when={sockets().length > 0}>
      <div class="perk-group">
        {/* The framework's label flexes its rule to fill */}
        <h4 class="section-label mt-3 mb-1.5">
          {props.category.category.displayProperties.name}
          <Show when={props.onToggleAll && rollable()}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={Boolean(props.all)}
              onClick={props.onToggleAll}
            >
              {props.all ? "Hide" : "All"}
            </Button>
          </Show>
        </h4>
        <div class="flex flex-wrap items-start gap-1">
          <For each={sockets()}>
            {(socket) => <Socket socket={socket} all={props.all} />}
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
      (category) => !COSMETIC.has(category.category.hash),
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

// The framework draws the perk disc itself
const PerkIcon = (props: { icon: string | undefined; enhanced?: boolean }) => (
  <Show
    when={props.icon}
    fallback={
      <span class="perk-icon" classList={{ enhanced: props.enhanced }} />
    }
  >
    {(icon) => (
      <img
        class="perk-icon"
        classList={{ enhanced: props.enhanced }}
        src={`${BUNGIE}${icon()}`}
        alt=""
        loading="lazy"
      />
    )}
  </Show>
);

export const Archetype = (props: { item: DimItem }) => {
  const found = createMemo(() => archetype(props.item));

  return (
    <Show when={found()}>
      {(plug) => (
        <div class="tooltip-perk" title={plug().description}>
          <PerkIcon icon={plug().icon} />
          <div class="perk-text">
            <b>{plug().name}</b>
          </div>
        </div>
      )}
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
          "text-dim": !props.item.masterwork,
        }}
      >
        <b class="tracking-wide uppercase">Masterwork</b>
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
      <div class="stat-list">
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
          <h4 class="section-label">{set().name}</h4>
          <For each={set().perks}>
            {(perk) => {
              const rated = () => setBonusFor(perk.hash);

              return (
                <div class="tooltip-perk items-start">
                  <PerkIcon icon={perk.icon} />
                  <div class="perk-text">
                    <b>
                      {perk.requiredSetCount} piece · {perk.name}
                    </b>
                    <span class="block whitespace-pre-wrap">
                      {perk.description}
                    </span>
                    <Show when={rated()}>
                      {(rating) => (
                        <div class="set-bonus-note">
                          <span class="set-bonus-rating">
                            <Show when={rating().tier}>
                              {(tier) => (
                                <span
                                  class={`roll-tier tier-${tier().toLowerCase()}`}
                                >
                                  {tier()}
                                </span>
                              )}
                            </Show>
                            <Show when={rating().rank}>
                              {(rank) => (
                                <span class="text-dim">
                                  #{rank()} of {setBonusesRanked()}
                                </span>
                              )}
                            </Show>
                          </span>
                          <Show when={rating().notes}>
                            {(notes) => (
                              <span class="block text-muted">
                                {sentence(notes())}
                              </span>
                            )}
                          </Show>
                        </div>
                      )}
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

const Changes = (props: { stats: StatChange[] }) => (
  <Show when={props.stats.length > 0}>
    <div class="flex flex-wrap gap-1 gap-x-2 pt-1">
      <For each={props.stats}>
        {(stat) => (
          <span
            class="text-sm whitespace-nowrap tabular-nums"
            classList={{
              "text-success": stat.better,
              "text-danger": !stat.better,
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
          <div class="tooltip-perk items-start">
            <PerkIcon icon={benefit.icon} enhanced={benefit.enhanced} />
            <div class="perk-text">
              <b classList={{ "text-light": benefit.enhanced }}>
                {benefit.name}
                <Show when={benefit.enhanced}>
                  {" "}
                  <span class="tag">Enhanced</span>
                </Show>
              </b>
              <Changes stats={benefit.stats} />
              <Show when={benefit.description}>
                <span class="block whitespace-pre-wrap">
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

const AegisMark = (props: { matched: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

// The sheet writes the notes lowercase
const sentence = (text: string): string =>
  text.replace(/\p{L}/u, (first) => first.toUpperCase());

const listed = (names: string[]): string => {
  if (names.length < 3) {
    return names.join(" or ");
  }

  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
};

/** Aegis's standing on the weapon, this roll's perk columns, and the tier they come to */
export const AegisNote = (props: { item: DimItem }) => {
  const verdict = () => assess(props.item);

  return (
    <Show when={verdict()}>
      {(read) => (
        <div class="aegis-note">
          <p class="aegis-line">
            <span class="aegis-lead">
              <Show when={read().rating.tier}>
                {(tier) => (
                  <span class={`roll-tier tier-${tier().toLowerCase()}`}>
                    {tier()}
                  </span>
                )}
              </Show>
              <span>
                <b class="tracking-wide uppercase">
                  {recommendedBase(read().rating.tier)
                    ? "Recommended base"
                    : "Not a recommended base"}
                </b>
                <Show when={read().rating.rank}>
                  {(rank) => (
                    <span class="text-dim">
                      {" "}
                      #{rank()} of {read().rating.ranked}{" "}
                      {read().rating.category}
                    </span>
                  )}
                </Show>
                <Show when={read().rating.notes}>
                  {(notes) => (
                    <span class="block text-muted">{sentence(notes())}</span>
                  )}
                </Show>
              </span>
            </span>
          </p>

          <Show when={read().slots.length > 0}>
            <ul class="aegis-slots">
              <For each={read().slots}>
                {(slot) => (
                  <li classList={{ hit: slot.matched, miss: !slot.matched }}>
                    <span class="aegis-slot-label">Perk {slot.slot}</span>
                    <span class="sr-only">
                      {slot.matched ? "recommended" : "not recommended"}
                    </span>
                    <Show
                      when={slot.options.length > 0}
                      fallback={
                        <span class="aegis-slot-rolled">
                          <span class="aegis-slot-perk plain">
                            <AegisMark matched={false} />
                            Empty
                          </span>
                        </span>
                      }
                    >
                      <span class="aegis-slot-rolled">
                        <For each={slot.options}>
                          {(option) => (
                            <span
                              class="aegis-slot-perk"
                              classList={{
                                wanted: option.wanted,
                                plain: !option.wanted,
                              }}
                            >
                              <AegisMark matched={option.wanted} />
                              {option.name}
                              <Show when={option.rank}>
                                {(rank) => (
                                  <span class="aegis-slot-rank">#{rank()}</span>
                                )}
                              </Show>
                              <Show when={option.plugged}>
                                <span class="aegis-slot-label">selected</span>
                              </Show>
                            </span>
                          )}
                        </For>
                      </span>
                    </Show>
                    <Show when={unrolled(slot).length > 0}>
                      <span class="aegis-slot-picks">
                        <span class="aegis-slot-label">
                          {slot.matched ? "Also wants" : "Wants"}
                        </span>{" "}
                        {listed(unrolled(slot))}
                      </span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>

            <p class="aegis-overall">
              <span class="aegis-slot-label">Overall</span>
              <span class="aegis-lead">
                <Show when={read().overall}>
                  {(tier) => (
                    <span class={`roll-tier tier-${tier().toLowerCase()}`}>
                      {tier()}
                    </span>
                  )}
                </Show>
                <span class="text-dim">
                  {read().score} of {read().of} perks recommended
                </span>
              </span>
            </p>
          </Show>
        </div>
      )}
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
    <Show when={uninstanced()}>
      <p class="m-0 text-sm text-warning">
        <b class="tracking-wide uppercase">Generic roll</b>
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
      onlyPlugged={uninstanced()}
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
          <Show when={uninstanced()}>
            <div class="tooltip-body">{warning}</div>
          </Show>
          <div class="tooltip-body">
            {props.lead}
            <Masterwork item={props.item} />
            <Archetype item={props.item} />
            <Stats item={props.item} against={props.against} />
          </div>
          <div class="tooltip-body">
            {perks}
            <SetBonus item={props.item} />
            {props.trail}
          </div>
        </>
      }
    >
      {(place) => (
        <>
          <Show when={props.lead}>
            <div class="min-w-0 self-start" style={cell(LEAD_ROW)}>
              {props.lead}
            </div>
          </Show>
          <div class="min-w-0 self-start" style={cell(SUMMARY_ROW)}>
            <AegisNote item={props.item} />
            {warning}
            <div class="flex flex-wrap items-baseline gap-x-3">
              <ItemPower item={props.item} />
              <Masterwork item={props.item} />
            </div>
            <Archetype item={props.item} />
          </div>
          <For each={place().stats}>
            {(stat, row) => (
              <div
                class="compare-stat"
                classList={{ total: stat.total }}
                style={{
                  "grid-column": place().statColumn,
                  "grid-row": String(STATS_ROW + row()),
                }}
              >
                <Show
                  when={own(stat.hash)}
                  fallback={<span class="dash">·</span>}
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
          <div class="min-w-0 self-start" style={cell(perksRow())}>
            {perks}
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

export const ItemHead = (props: { item: DimItem; compact?: boolean }) => (
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
              "line-clamp-2 pr-6 text-md leading-5 whitespace-normal":
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
    <Show when={!props.compact}>
      <div class="tooltip-body py-2">
        <ItemPower item={props.item} />
      </div>
    </Show>
  </>
);

// DestinyAmmunitionType Primary, Special and Heavy
const AMMO: Record<number, { url: string; name: string }> = {
  1: { url: ammoPrimary, name: "Primary" },
  2: { url: ammoSpecial, name: "Special" },
  3: { url: ammoHeavy, name: "Heavy" },
};

export const ItemPower = (props: { item: DimItem }) => (
  <Show when={props.item.power > 0 || props.item.element || props.item.energy}>
    <div class="tooltip-power">
      <Show when={props.item.power > 0}>
        <span class="power-value">{props.item.power}</span>
      </Show>
      <Show when={props.item.element}>
        {(element) => (
          <span class="power-type">
            <Show when={element().displayProperties.icon}>
              {(icon) => (
                <img class="element-icon" src={`${BUNGIE}${icon()}`} alt="" />
              )}
            </Show>
            {element().displayProperties.name}
          </span>
        )}
      </Show>
      <Show when={props.item.energy}>
        {(energy) => (
          <span class="power-type">
            Energy {energy().energyUsed}/{energy().energyCapacity}
          </span>
        )}
      </Show>
      <Show when={AMMO[props.item.ammoType]}>
        {(ammo) => (
          <img
            class="ammo-icon"
            src={ammo().url}
            alt={ammo().name}
            title={ammo().name}
          />
        )}
      </Show>
    </div>
  </Show>
);
