import type { DimItem } from "app/inventory/item-types";

import { ItemDetails, ItemHead } from "./ItemPanel.tsx";
import { AnchoredPanel } from "./ui/AnchoredPanel.tsx";

interface Props {
  item: DimItem;
  against: DimItem | undefined;
  cursorX: number | undefined;
}

export const HoverCard = (props: Props) => (
  <AnchoredPanel class="item-tooltip hover-card" cursorX={props.cursorX}>
    <ItemHead item={props.item} />
    <ItemDetails item={props.item} against={props.against} />
  </AnchoredPanel>
);
