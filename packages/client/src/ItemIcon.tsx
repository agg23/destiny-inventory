import type { DimItem } from "app/inventory/item-types";
import { Show } from "solid-js";

const BUNGIE = "https://www.bungie.net";

interface Props {
  item: DimItem;
  selected: boolean;
  onSelect: (item: DimItem) => void;
}

// Power for gear, stack size for everything else; nothing else earns the corner
const corner = (item: DimItem): number | undefined => {
  if (item.power > 0) {
    return item.power;
  }

  return item.amount > 1 ? item.amount : undefined;
};

export const ItemIcon = (props: Props) => (
  <button
    type="button"
    class="item"
    classList={{
      equipped: props.item.equipped,
      selected: props.selected,
      [`rarity-${props.item.rarity.toLowerCase()}`]: true,
    }}
    title={`${props.item.name}\n${props.item.typeName}`}
    onClick={() => props.onSelect(props.item)}
  >
    <img src={`${BUNGIE}${props.item.icon}`} loading="lazy" alt={props.item.name} />
    <Show when={props.item.iconOverlay}>
      {(overlay) => <img class="overlay" src={`${BUNGIE}${overlay()}`} loading="lazy" alt="" />}
    </Show>
    <Show when={corner(props.item)}>{(value) => <span class="corner">{value()}</span>}</Show>
  </button>
);
