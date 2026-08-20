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
import { createMemo, For, Show } from "solid-js";

import { delta, unmovable, type Delta } from "./compare.ts";
import { archetype, benefits, setBonus, type StatChange } from "./perks.ts";
import { shortStat } from "./statNames.ts";
import { Button } from "./ui/Button.tsx";
import { SplitButton, type Choice } from "./ui/SplitButton.tsx";

export const BUNGIE = "https://www.bungie.net";

// DIM derives the armor total itself rather than reading it off a real stat
export const TOTAL = -1000;

// BucketHashes.LostItems, inlined rather than pulling in DIM's whole enum table
const LOST_ITEMS = 215593132;

// SocketCategoryHashes for weapon, armor and ghost cosmetics. Shaders, ornaments and trackers
// change nothing a player compares, and each category costs a labelled row
const COSMETIC = new Set([2048875504, 1926152773, 2549160099]);

export interface MoveProps {
  item: DimItem;
  stores: DimStore[];
  active: DimStore | undefined;
  onMove: (target: DimStore, equip: boolean) => void;
  onPrefer: (target: DimStore) => void;
  moving: string | undefined;
  moveError: string | undefined;
  // Two items share the rail, so the target moves into the caret menu to buy back the width
  compact?: boolean;
}

const label = (store: DimStore) => (store.isVault ? "Vault" : store.className);

// Transferring away always means the vault; everything else follows the active character
export const Moves = (props: MoveProps) => {
  const vault = () => props.stores.find((store) => store.isVault);
  const characters = () => props.stores.filter((store) => !store.isVault);

  const canTransfer = () => !props.item.notransfer;

  // The mover can shuffle items aside to make room, so only a hard wall counts as no room
  const noRoom = (target: DimStore): string | undefined => {
    const item = props.item;
    const space = potentialSpaceLeftForItem(target, item, props.stores);

    if (space.guaranteed > 0) {
      return undefined;
    }

    // Unique stacks cap per store, and account-wide buckets live on the current character
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

  const blocked = (target: DimStore): string | undefined => {
    const item = props.item;

    if (unmovable(item)) {
      return "Cannot be pulled from the Postmaster";
    }

    if (item.location.hash === LOST_ITEMS) {
      if (!item.canPullFromPostmaster) {
        return "Cannot be pulled from the Postmaster";
      }

      // A pull lands on the owning character regardless of the chosen target
      const owner = props.stores.find((store) => store.id === item.owner);

      return owner ? noRoom(owner) : undefined;
    }

    if (item.notransfer) {
      return "Cannot be transferred";
    }

    return noRoom(target);
  };

  // A Warlock helmet on a Titan is dead weight, so a class it cannot serve is not a target
  const holders = () =>
    props.stores.filter(
      (store) =>
        store.isVault ||
        isClassCompatible(props.item.classType, store.classType),
    );

  const transferTo = () => {
    const home = props.stores.find((store) => store.id === props.item.owner);

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

  const equippable = () =>
    characters().filter(
      (store) =>
        itemCanBeEquippedBy(props.item, store) &&
        !(props.item.equipped && props.item.owner === store.id),
    );

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
    // Reaching past the default is the signal that a different character is wanted
    if (manual && !target.isVault) {
      props.onPrefer(target);
    }

    props.onMove(target, equip);
  };

  // Every target is listed, the default included, so the menu is the whole picture
  const choices = (targets: DimStore[], equip: boolean): Choice[] =>
    targets.map((store) => ({
      id: store.id,
      label: label(store),
      reason: equip ? undefined : blocked(store),
      onChoose: () => act(store, equip, true),
    }));

  const transferTargets = () =>
    holders().filter((store) => store.id !== props.item.owner && canTransfer());

  return (
    <div class="flex flex-col items-stretch gap-1.5">
      <Show when={transferTo()}>
        {(target) => (
          <SplitButton
            block
            size="sm"
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
            size="sm"
            label={props.compact ? "Equip" : `Equip on ${label(target())}`}
            disabled={!!props.moving}
            onPrimary={() => act(target(), true, false)}
            choices={choices(equippable(), true)}
          />
        )}
      </Show>
      <Show when={props.moving}>
        {(status) => <p class="text-muted">{status()}</p>}
      </Show>
      <Show when={props.moveError}>
        {(message) => <p class="text-danger">{message()}</p>}
      </Show>
    </div>
  );
};

// A bare sign reads as arithmetic; the color is what says whether the number is good news
export const StatDelta = (props: { delta: Delta | undefined }) => (
  <Show when={props.delta}>
    {(change) => (
      <span
        class="text-sm whitespace-nowrap tabular-nums"
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

// The framework's stat list ends in one value cell, so the number and its delta share it
// rather than the grid growing a fourth column that the compare rail cannot afford
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
      // Rounds per minute has no bar, so its number takes the bar's column and stays beside
      // its label rather than stranding itself at the far right of an empty row
      "col-span-2 justify-start": !props.stat.bar,
      "justify-end": Boolean(props.stat.bar),
    }}
  >
    <span>{props.stat.value}</span>
    <Show when={props.comparing}>
      <span class="w-[4ch] text-left">
        <StatDelta delta={delta(props.stat, props.against)} />
      </span>
    </Show>
  </span>
);

export const StatBar = (props: { stat: DimStat; total?: boolean }) => {
  const fraction = () =>
    props.stat.maximumValue > 0
      ? Math.min(1, Math.abs(props.stat.value) / props.stat.maximumValue)
      : 0;

  return (
    <Show when={props.stat.bar}>
      <span class="stat-bar" classList={{ total: props.total }}>
        <span class="stat-fill" style={{ width: `${fraction() * 100}%` }} />
      </span>
    </Show>
  );
};

export const Bar = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
}) => {
  // Cells rather than a row, so every column lines up down the whole block the way the
  // framework's stat list does it
  const total = () => props.stat.statHash === TOTAL;

  return (
    <>
      <span class="stat-name" classList={{ total: total() }}>
        {shortStat(props.stat.displayProperties.name)}
      </span>
      <StatBar stat={props.stat} total={total()} />
      <StatValue
        stat={props.stat}
        against={props.against}
        comparing={props.comparing}
        total={total()}
      />
    </>
  );
};

// Name and icon together, since the enhanced variant of a perk shares both with the plain one
const identity = (plug: DimPlug): string => {
  const { name, icon } = plug.plugDef.displayProperties;

  return `${name}|${icon}`;
};

// The game shows a socket as a column of everything it could hold, with what is plugged lit
// and the rest dimmed. A fixed roll is a column of one, which is why exotics look like a row
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

    // Bungie lists the enhanced variant of every perk as its own plug, and ships the odd
    // straight duplicate, both of which would show the column twice over. Two plugs a player
    // cannot tell apart are one entry
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

    // An enhanced roll shares its name and icon with the plain version, so leaving it out of
    // the column would collapse it into that one and light nothing up
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

    return description ? `${name}\n\n${description}` : name;
  };

  return (
    <div class="flex flex-col gap-1">
      <For each={options()}>
        {(plug) => (
          <img
            class="plug"
            classList={{
              plugged: plug.plugDef.hash === props.socket.plugged?.plugDef.hash,
              disabled: !plug.enabled,
              // Only the rolled perk columns are circles; an intrinsic is a frame, not a roll
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
        )}
      </For>
    </div>
  );
};

const Category = (props: {
  sockets: DimSockets;
  category: DimSocketCategory;
  all?: boolean;
  onToggleAll?: () => void;
}) => {
  const sockets = () =>
    getSocketsByIndexes(props.sockets, props.category.socketIndexes).filter(
      (socket) => socket.plugged ?? socket.plugOptions.length > 0,
    );

  // Only a column that could have rolled something else has anything to expand
  const rollable = () =>
    sockets().some(
      (socket) => socket.isPerk && (socket.plugSet?.plugs.length ?? 0) > 1,
    );

  return (
    <Show when={sockets().length > 0}>
      <div class="perk-group">
        {/* The framework's label flexes its rule to fill, so the toggle rides in the heading */}
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
  onToggleAll?: () => void;
}) => {
  // The archetype reads above the stats now, and its category holds nothing else
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
              onToggleAll={props.onToggleAll}
            />
          )}
        </For>
      )}
    </Show>
  );
};

// The framework draws the perk disc itself, so a missing icon still leaves the row aligned
const PerkIcon = (props: { icon: string | undefined; enhanced?: boolean }) => (
  <Show
    when={props.icon}
    fallback={<span class="perk-icon" classList={{ enhanced: props.enhanced }} />}
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

// Armor's identity rather than a plug, so it sits with the stats it decides
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

export const Stats = (props: { item: DimItem; against?: DimItem }) => {
  const sorted = () =>
    [...(props.item.stats ?? [])].sort((a, b) => a.sort - b.sort);

  const theirs = (hash: number) =>
    props.against?.stats?.find((stat) => stat.statHash === hash);

  return (
    <Show when={props.item.stats?.length}>
      <div class="stat-list">
        <For each={sorted()}>
          {(stat) => (
            <Bar
              stat={stat}
              against={theirs(stat.statHash)}
              comparing={Boolean(props.against)}
            />
          )}
        </For>
      </div>
    </Show>
  );
};

// Armor only says which set it belongs to; what the set does lives on its sandbox perks
export const SetBonus = (props: { item: DimItem }) => {
  const bonus = createMemo(() => setBonus(props.item));

  return (
    <Show when={bonus()}>
      {(set) => (
        <>
          <h4 class="section-label">{set().name}</h4>
          <For each={set().perks}>
            {(perk) => (
              <div class="tooltip-perk items-start">
                <PerkIcon icon={perk.icon} />
                <div class="perk-text">
                  <b>
                    {perk.requiredSetCount} piece · {perk.name}
                  </b>
                  <span class="block whitespace-pre-wrap">{perk.description}</span>
                </div>
              </div>
            )}
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

// Icons say which perks are on; this says what they actually do, which is the part you read
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

// DestinyClass Titan, Hunter and Warlock; anything else is not restricted to one
const CLASSES = new Set([0, 1, 2]);

// Every armor piece is locked to one class, and "Helmet" alone does not say which. Bonds,
// marks and cloaks already carry it in the type name Bungie gives them
export const typeName = (item: DimItem): string => {
  const owner = item.classTypeNameLocalized;

  if (!CLASSES.has(item.classType) || item.typeName.startsWith(owner)) {
    return item.typeName;
  }

  return `${owner} ${item.typeName}`;
};

// The game's own inspection header: the rarity carries the color, so the tier needs no words
export const ItemHead = (props: { item: DimItem; compact?: boolean }) => (
  <div
    class={`tooltip-header ${props.item.rarity.toLowerCase()}`}
    classList={{ "h-(--item-head) p-0": props.compact }}
  >
    <div class="flex h-full items-stretch gap-2">
      {/* Flush and square to the tinted block, the way the game draws it. The hover card needs
          no icon at all: the tile it came from is under the pointer */}
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
        {/* Wraps rather than ellipsizes: the header is the one place the whole name matters.
            Two to a rail leaves room for two lines and no more */}
        <div
          class="tooltip-name"
          classList={{
            "line-clamp-2 pr-6 text-md leading-5 whitespace-normal": props.compact,
          }}
        >
          {props.item.name}
        </div>
        <div class="tooltip-type">
          <span class="max-w-full truncate">{typeName(props.item)}</span>
        </div>
      </div>
    </div>
  </div>
);

// Power is the headline number in the game's own inspect screen, not a footnote on the type row
export const ItemPower = (props: { item: DimItem }) => (
  <Show when={props.item.power > 0 || props.item.element}>
    <div class="tooltip-power">
      <Show when={props.item.power > 0}>
        <span class="power-value">{props.item.power}</span>
      </Show>
      <Show when={props.item.element}>
        {(element) => (
          <span class="power-type">{element().displayProperties.name}</span>
        )}
      </Show>
    </div>
  </Show>
);
