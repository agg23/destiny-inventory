import type { DimItem } from "app/inventory/item-types";

import type { Tier } from "@dvm/defs-core";

import { menued } from "../core/items/itemMenu.ts";
import {
  dismiss,
  preview,
  previewed,
  type CardCost,
} from "../core/items/preview.ts";
import { assess, setRatings } from "../core/items/rolls.ts";
import type { Mode } from "../core/items/rollTypes.ts";
import { tagFor } from "../core/items/tags.ts";
import { setTiers, Tile } from "./Tile.tsx";

interface Props {
  item: DimItem;
  selected?: boolean;
  highlight?: boolean;
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
      props.highlight && previewed()?.item.index === props.item.index
        ? "hovered"
        : "",
      props.highlight && menued(props.item) ? "menued" : "",
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
