import type { DimItem, DimSocketCategory, DimSockets, DimStat } from "app/inventory/item-types";
import { getSocketsByIndexes } from "app/utils/socket-utils";
import { For, Show } from "solid-js";

const BUNGIE = "https://www.bungie.net";

interface Props {
  item: DimItem;
  onClose: () => void;
}

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
