import type { DimItem } from "app/inventory/item-types";
import { Show } from "solid-js";

import {
  Archetype,
  ItemHead,
  ItemPower,
  Perks,
  SetBonus,
  Stats,
} from "./ItemPanel.tsx";
import { AnchoredPanel } from "./ui/AnchoredPanel.tsx";

interface Props {
  item: DimItem;
  against: DimItem | undefined;
  anchor: DOMRect;
}

export const HoverCard = (props: Props) => {
  // An uninstanced item carries no roll
  const uninstanced = () => props.item.id === "0";

  return (
    <AnchoredPanel class="item-tooltip hover-card" anchor={props.anchor}>
      <ItemHead item={props.item} />
      <Show when={uninstanced()}>
        <div class="tooltip-body">
          <p class="m-0 text-sm text-warning">
            <b class="tracking-wide uppercase">Generic roll</b>
            <span class="block">
              Stats and perks come from the definition. The weapon that was used
              may have rolled differently.
            </span>
          </p>
        </div>
      </Show>
      <div class="tooltip-body">
        <ItemPower item={props.item} />
        <Archetype item={props.item} />
        <Stats item={props.item} against={props.against} />
      </div>
      <div class="tooltip-body">
        <Perks item={props.item} onlyPlugged={uninstanced()} />
        <SetBonus item={props.item} />
      </div>
    </AnchoredPanel>
  );
};
