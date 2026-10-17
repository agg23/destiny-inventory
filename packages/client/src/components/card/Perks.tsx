import type {
  DimItem,
  DimPlug,
  DimSocket,
  DimSocketCategory,
  DimSockets,
} from "app/inventory/item-types";
import {
  getArmorArchetypeSocket,
  getSocketsByIndexes,
  isEnhancedPerk,
  socketContainsIntrinsicPlug,
} from "app/utils/socket-utils";
import { For, Show } from "solid-js";

import { BUNGIE } from "../../core/api/bungie.ts";
import { dismissPerk, previewPerk } from "../../core/items/perkPreview.ts";
import { isIntrinsicPlug } from "../../core/items/perks.ts";
import { perkFor } from "../../core/items/rolls.ts";
import { cn } from "../lib/cn.ts";
import { LABEL, sentence } from "../lib/text.ts";
import { Button } from "../lib/zaidan/button.tsx";

// SocketCategoryHashes for weapon, armor and ghost cosmetics
const COSMETIC = new Set([2048875504, 1926152773, 2549160099]);

// SocketCategoryHashes.IntrinsicTraits
const INTRINSIC_TRAITS = 3956125808;

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
