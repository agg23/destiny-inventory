import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { BUNGIE } from "./bungie.ts";
import { dismiss, preview } from "./preview.ts";
import { assess, setRatings, type AegisSetBonus } from "./rolls.ts";
import { settings } from "./settings.ts";

interface Props {
  item: DimItem;
  selected?: boolean;
  onSelect?: (item: DimItem, additive: boolean) => void;
  badges?: boolean;
  class?: string;
}

// The framework's power slot hangs below the tile
const corner = (item: DimItem): number | undefined => {
  if (item.power > 0) {
    return item.power;
  }

  return item.amount > 1 ? item.amount : undefined;
};

const rated = (item: DimItem): AegisSetBonus[] | undefined => {
  const bonuses = setRatings(item);

  return bonuses.length > 0 && bonuses.every((bonus) => bonus.tier)
    ? bonuses
    : undefined;
};

const tileClass = (props: Props): string =>
  [
    "item-tile small",
    props.item.rarity.toLowerCase(),
    props.item.equipped ? "equipped" : "",
    props.selected ? "selected" : "",
    props.class ?? "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

const Face = (props: Props) => (
  <>
    <img
      src={`${BUNGIE}${props.item.icon}`}
      loading="lazy"
      alt={props.item.name}
    />
    <span class="tile-edge" />
    <Show when={props.badges !== false}>
      <Show when={settings().overlay && props.item.iconOverlay}>
        {(overlay) => (
          <img
            class="overlay"
            src={`${BUNGIE}${overlay()}`}
            loading="lazy"
            alt=""
          />
        )}
      </Show>
      <Show when={props.item.tier > 0}>
        <span class="gear-tier">{props.item.tier}</span>
      </Show>
      <Show when={corner(props.item)}>
        {(value) => <span class="item-quantity">{value()}</span>}
      </Show>
      <span class="tile-icons">
        <Show when={props.item.element?.displayProperties.icon}>
          {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
        </Show>
        <Show when={props.item.breakerType?.displayProperties.icon}>
          {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
        </Show>
      </span>
      <Show when={assess(props.item)?.overall}>
        {(overall) => (
          <span class={`item-tier tier-${overall().toLowerCase()}`}>
            {overall()}
          </span>
        )}
      </Show>
      <Show when={rated(props.item)}>
        {(pair) => (
          <span class="item-tier set-tier">
            <For each={pair()}>
              {(bonus) => (
                <span class={`tier-${bonus.tier!.toLowerCase()}`}>
                  {bonus.tier}
                </span>
              )}
            </For>
          </span>
        )}
      </Show>
    </Show>
  </>
);

export const ItemIcon = (props: Props) => (
  <Show
    when={props.onSelect}
    fallback={
      <span class={tileClass(props)} data-item-index={props.item.index}>
        <Face {...props} />
      </span>
    }
  >
    {(onSelect) => (
      <button
        type="button"
        class={tileClass(props)}
        data-item-index={props.item.index}
        onClick={(e) => onSelect()(props.item, e.shiftKey)}
        onMouseEnter={(e) => preview(props.item, e.currentTarget)}
        onMouseLeave={() => dismiss(props.item)}
      >
        <Face {...props} />
      </button>
    )}
  </Show>
);
