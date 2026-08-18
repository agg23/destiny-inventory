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
import { isClassCompatible, itemCanBeEquippedBy } from "app/utils/item-utils";
import { createMemo, For, Show } from "solid-js";

import { delta, type Delta } from "./compare.ts";
import { archetype, benefits, setBonus, type StatChange } from "./perks.ts";
import { shortStat } from "./statNames.ts";
import { Button } from "./ui/Button.tsx";
import { SplitButton, type Choice } from "./ui/SplitButton.tsx";

export const BUNGIE = "https://www.bungie.net";

// DIM derives the armor total itself rather than reading it off a real stat
export const TOTAL = -1000;

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
      onChoose: () => act(store, equip, true),
    }));

  const transferTargets = () =>
    holders().filter((store) => store.id !== props.item.owner && canTransfer());

  return (
    <div class="moves">
      <Show when={transferTo()}>
        {(target) => (
          <SplitButton
            block
            label={
              props.compact ? "Transfer" : `Transfer to ${label(target())}`
            }
            disabled={!!props.moving}
            onPrimary={() => act(target(), false, false)}
            choices={choices(transferTargets(), false)}
          />
        )}
      </Show>
      <Show when={equipOn()}>
        {(target) => (
          <SplitButton
            block
            label={props.compact ? "Equip" : `Equip on ${label(target())}`}
            disabled={!!props.moving}
            onPrimary={() => act(target(), true, false)}
            choices={choices(equippable(), true)}
          />
        )}
      </Show>
      <Show when={props.moving}>
        {(status) => <p class="meta">{status()}</p>}
      </Show>
      <Show when={props.moveError}>
        {(message) => <p class="error">{message()}</p>}
      </Show>
    </div>
  );
};

// A bare sign reads as arithmetic; the color is what says whether the number is good news
export const StatDelta = (props: { delta: Delta | undefined }) => (
  <Show when={props.delta} fallback={<span />}>
    {(change) => (
      <span class="delta" classList={{ better: change().better }}>
        {change().value > 0 ? "+" : "−"}
        {Math.abs(change().value)}
      </span>
    )}
  </Show>
);

export const Bar = (props: {
  stat: DimStat;
  against?: DimStat;
  comparing?: boolean;
}) => {
  const fraction = () =>
    props.stat.maximumValue > 0
      ? Math.min(1, Math.abs(props.stat.value) / props.stat.maximumValue)
      : 0;

  return (
    <div class="stat" classList={{ total: props.stat.statHash === TOTAL }}>
      <span class="stat-name">
        {shortStat(props.stat.displayProperties.name)}
      </span>
      <span class="stat-value">{props.stat.value}</span>
      <Show when={props.comparing}>
        <StatDelta delta={delta(props.stat, props.against)} />
      </Show>
      <Show when={props.stat.bar} fallback={<span />}>
        <span class="stat-bar">
          <span style={{ width: `${fraction() * 100}%` }} />
        </span>
      </Show>
    </div>
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
    <div class="socket">
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
        <div class="perk-head">
          <h4>{props.category.category.displayProperties.name}</h4>
          <Show when={props.onToggleAll && rollable()}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={Boolean(props.all)}
              onClick={props.onToggleAll}
            >
              {props.all ? "Hide all" : "Show all"}
            </Button>
          </Show>
        </div>
        <div class="sockets">
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
    const categories = props.item.sockets?.categories ?? [];

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

// Armor's identity rather than a plug, so it sits with the stats it decides
export const Archetype = (props: { item: DimItem }) => {
  const found = createMemo(() => archetype(props.item));

  return (
    <Show when={found()}>
      {(plug) => (
        <div class="archetype" title={plug().description}>
          <Show when={plug().icon} fallback={<span class="perk-icon" />}>
            {(icon) => (
              <img
                class="perk-icon"
                src={`${BUNGIE}${icon()}`}
                alt=""
                loading="lazy"
              />
            )}
          </Show>
          <span class="benefit-name">{plug().name}</span>
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
      <div class="stats" classList={{ comparing: Boolean(props.against) }}>
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
        <div class="set-bonus">
          <h4>{set().name}</h4>
          <For each={set().perks}>
            {(perk) => (
              <div class="set-perk">
                <Show when={perk.icon} fallback={<span class="perk-icon" />}>
                  {(icon) => (
                    <img
                      class="perk-icon"
                      src={`${BUNGIE}${icon()}`}
                      alt=""
                      loading="lazy"
                    />
                  )}
                </Show>
                <div>
                  <div class="set-perk-name">
                    {perk.requiredSetCount} piece · {perk.name}
                  </div>
                  <p class="description">{perk.description}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      )}
    </Show>
  );
};

const Changes = (props: { stats: StatChange[] }) => (
  <Show when={props.stats.length > 0}>
    <div class="benefit-stats">
      <For each={props.stats}>
        {(stat) => (
          <span class="delta" classList={{ better: stat.better }}>
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
      <div class="benefits">
        <For each={list()}>
          {(benefit) => (
            <div class="benefit">
              <div class="benefit-head">
                <Show when={benefit.icon} fallback={<span class="perk-icon" />}>
                  {(icon) => (
                    <img
                      class="perk-icon"
                      classList={{ enhanced: benefit.enhanced }}
                      src={`${BUNGIE}${icon()}`}
                      alt=""
                      loading="lazy"
                    />
                  )}
                </Show>
                <span
                  class="benefit-name"
                  classList={{ enhanced: benefit.enhanced }}
                >
                  {benefit.name}
                </span>
                <Show when={benefit.enhanced}>
                  <span class="tag">Enhanced</span>
                </Show>
              </div>
              <Changes stats={benefit.stats} />
              <Show when={benefit.description}>
                <p class="description">{benefit.description}</p>
              </Show>
            </div>
          )}
        </For>
      </div>
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

export const ItemHead = (props: { item: DimItem }) => (
  <div class="item-head">
    <img src={`${BUNGIE}${props.item.icon}`} alt="" width="40" height="40" />
    <div>
      <div class="name">{props.item.name}</div>
      <div class="meta">
        {typeName(props.item)}
        <Show when={props.item.power > 0}> · {props.item.power}</Show>
        <Show when={props.item.element}>
          {(element) => <> · {element().displayProperties.name}</>}
        </Show>
      </div>
    </div>
  </div>
);
