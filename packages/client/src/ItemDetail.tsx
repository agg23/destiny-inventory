import type { DimItem, DimSocketCategory, DimSockets, DimStat } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { getSocketsByIndexes } from "app/utils/socket-utils";
import { itemCanBeEquippedBy } from "app/utils/item-utils";
import { For, Show } from "solid-js";

import { SplitButton, type Choice } from "./SplitButton.tsx";

const BUNGIE = "https://www.bungie.net";

interface Props {
  item: DimItem;
  stores: DimStore[];
  active: DimStore | undefined;
  onMove: (target: DimStore, equip: boolean) => void;
  onPrefer: (target: DimStore) => void;
  moving: string | undefined;
  moveError: string | undefined;
  onClose: () => void;
}

const label = (store: DimStore) => (store.isVault ? "Vault" : store.className);

/**
 * Two controls rather than a grid of them: each does the likely thing, and the caret holds
 * the rest. Transferring away always means the vault, since that is what it almost always
 * means; everything else follows the active character.
 */
const Moves = (props: Props) => {
  const vault = () => props.stores.find((store) => store.isVault);
  const characters = () => props.stores.filter((store) => !store.isVault);

  const canTransfer = () => !props.item.notransfer;

  // Away from a character is the vault, into a character is whoever is active
  const transferTo = () => {
    const home = props.stores.find((store) => store.id === props.item.owner);

    if (home?.isVault) {
      return props.active;
    }

    return vault();
  };

  const equipOn = () => {
    const targets = equippable();

    if (props.active && targets.some((store) => store.id === props.active?.id)) {
      return props.active;
    }

    return targets[0];
  };

  // An item already equipped where it is cannot be equipped there again
  const equippable = () =>
    characters().filter(
      (store) =>
        itemCanBeEquippedBy(props.item, store) &&
        !(props.item.equipped && props.item.owner === store.id),
    );

  const act = (target: DimStore, equip: boolean, manual: boolean) => {
    // Reaching past the default is the signal that the user wants a different character
    if (manual && !target.isVault) {
      props.onPrefer(target);
    }

    props.onMove(target, equip);
  };

  const others = (targets: DimStore[], primary: DimStore | undefined, equip: boolean): Choice[] =>
    targets
      .filter((store) => store.id !== primary?.id)
      .map((store) => ({
        id: store.id,
        label: label(store),
        onChoose: () => act(store, equip, true),
      }));

  const transferTargets = () =>
    props.stores.filter((store) => store.id !== props.item.owner && canTransfer());

  return (
    <div class="moves">
      <Show when={transferTo()}>
        {(target) => (
          <SplitButton
            label={`Transfer to ${label(target())}`}
            disabled={!!props.moving}
            onPrimary={() => act(target(), false, false)}
            choices={others(transferTargets(), target(), false)}
          />
        )}
      </Show>
      <Show when={equipOn()}>
        {(target) => (
          <SplitButton
            label={`Equip on ${label(target())}`}
            disabled={!!props.moving}
            onPrimary={() => act(target(), true, false)}
            choices={others(equippable(), target(), true)}
          />
        )}
      </Show>
      <Show when={props.moving}>{(status) => <p class="meta">{status()}</p>}</Show>
      <Show when={props.moveError}>{(message) => <p class="error">{message()}</p>}</Show>
    </div>
  );
};

const Bar = (props: { stat: DimStat }) => {
  const fraction = () =>
    props.stat.maximumValue > 0
      ? Math.min(1, Math.abs(props.stat.value) / props.stat.maximumValue)
      : 0;

  return (
    <div class="stat">
      <span class="stat-name">{props.stat.displayProperties.name}</span>
      <span class="stat-value">{props.stat.value}</span>
      <Show when={props.stat.bar} fallback={<span />}>
        <span class="stat-bar">
          <span style={{ width: `${fraction() * 100}%` }} />
        </span>
      </Show>
    </div>
  );
};

// Only what is actually plugged, since an empty socket says nothing about the roll
const Category = (props: { sockets: DimSockets; category: DimSocketCategory }) => {
  const plugged = () =>
    getSocketsByIndexes(props.sockets, props.category.socketIndexes)
      .map((socket) => socket.plugged)
      .filter((plug) => plug !== null);

  return (
    <Show when={plugged().length > 0}>
      <div class="perk-group">
        <h4>{props.category.category.displayProperties.name}</h4>
        <div class="perks">
          <For each={plugged()}>
            {(plug) => (
              <div class="perk" classList={{ disabled: !plug.enabled }}>
                <img
                  src={`${BUNGIE}${plug.plugDef.displayProperties.icon}`}
                  loading="lazy"
                  alt=""
                />
                {plug.plugDef.displayProperties.name}
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};

export const ItemDetail = (props: Props) => (
  <aside class="detail">
    <header class="detail-head">
      <img src={`${BUNGIE}${props.item.icon}`} alt="" width="56" height="56" />
      <div>
        <div class="name">{props.item.name}</div>
        <div class="meta">
          {props.item.typeName}
          <Show when={props.item.power > 0}> · {props.item.power}</Show>
          <Show when={props.item.element}>{(element) => <> · {element().displayProperties.name}</>}</Show>
        </div>
      </div>
      <button type="button" onClick={props.onClose}>
        Close
      </button>
    </header>

    <Moves {...props} />

    <Show when={props.item.stats?.length}>
      <div class="stats">
        <For each={[...(props.item.stats ?? [])].sort((a, b) => a.sort - b.sort)}>
          {(stat) => <Bar stat={stat} />}
        </For>
      </div>
    </Show>

    <Show when={props.item.sockets}>
      {(sockets) => (
        <For each={sockets().categories}>
          {(category) => <Category sockets={sockets()} category={category} />}
        </For>
      )}
    </Show>

    <Show when={props.item.description}>
      <p class="description">{props.item.description}</p>
    </Show>
  </aside>
);
