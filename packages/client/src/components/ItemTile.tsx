import type { DimItem } from "app/inventory/item-types";

import { dismiss, preview, type CardCost } from "../core/items/preview.ts";
import {
  assess,
  setRatings,
  type Mode,
  type Tier,
} from "../core/items/rolls.ts";
import { tagFor } from "../core/items/tags.ts";
import { setTiers, Tile } from "./Tile.tsx";

interface Props {
  item: DimItem;
  selected?: boolean;
  onSelect?: (item: DimItem, event: MouseEvent) => void;
  badges?: boolean;
  class?: string;
  notes?: string[];
  cost?: CardCost;
}

// The framework's power slot hangs below the tile
const corner = (item: DimItem): number | undefined => {
  if (item.power > 0) {
    return item.power;
  }

  return item.amount > 1 ? item.amount : undefined;
};

const itemTiers = (item: DimItem, mode: Mode): Tier[] | undefined => {
  const overall = assess(item, mode)?.overall;

  if (overall) {
    return [overall];
  }

  return setTiers(setRatings(item, mode));
};

export const ItemTile = (props: Props) => (
  <Tile
    name={props.item.name}
    icon={props.item.icon}
    overlay={props.item.iconOverlay}
    rarity={props.item.rarity}
    classes={[
      props.item.equipped ? "equipped" : "",
      props.selected ? "selected" : "",
      props.class ?? "",
    ]}
    index={props.item.index}
    gearTier={props.item.tier}
    corner={corner(props.item)}
    tagColor={tagFor(props.item.id)?.color}
    icons={[
      props.item.element?.displayProperties.icon,
      props.item.breakerType?.displayProperties.icon,
    ]}
    tiers={(mode) => itemTiers(props.item, mode)}
    masterwork={props.item.masterwork}
    badges={props.badges}
    onClick={
      props.onSelect
        ? (event) => props.onSelect?.(props.item, event)
        : undefined
    }
    onEnter={(element) =>
      preview(props.item, element, { notes: props.notes, cost: props.cost })
    }
    onLeave={() => dismiss(props.item)}
  />
);
