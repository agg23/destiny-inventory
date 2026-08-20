import type { DimItem } from "app/inventory/item-types";
import { Show } from "solid-js";

const BUNGIE = "https://www.bungie.net";

interface Props {
  item: DimItem;
  selected: boolean;
  onSelect: (item: DimItem) => void;
  onHover: (item: DimItem, anchor: DOMRect) => void;
  onLeave: (item: DimItem) => void;
}

// The framework's power slot hangs below the tile
const corner = (item: DimItem): number | undefined => {
  if (item.power > 0) {
    return item.power;
  }

  return item.amount > 1 ? item.amount : undefined;
};

export const ItemIcon = (props: Props) => (
  <button
    type="button"
    class="item-tile small"
    classList={{
      equipped: props.item.equipped,
      selected: props.selected,
      [props.item.rarity.toLowerCase()]: true,
    }}
    onClick={() => props.onSelect(props.item)}
    onMouseEnter={(e) =>
      props.onHover(props.item, e.currentTarget.getBoundingClientRect())
    }
    onMouseLeave={() => props.onLeave(props.item)}
  >
    <img
      src={`${BUNGIE}${props.item.icon}`}
      loading="lazy"
      alt={props.item.name}
    />
    <Show when={props.item.iconOverlay}>
      {(overlay) => (
        <img
          class="overlay"
          src={`${BUNGIE}${overlay()}`}
          loading="lazy"
          alt=""
        />
      )}
    </Show>
    <Show when={corner(props.item)}>
      {(value) => <span class="item-quantity">{value()}</span>}
    </Show>
  </button>
);
