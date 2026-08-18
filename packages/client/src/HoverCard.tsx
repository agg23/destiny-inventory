import type { DimItem } from "app/inventory/item-types";
import { createMemo } from "solid-js";

import { ItemHead, Perks, Stats } from "./ItemPanel.tsx";

const GAP = 8;
const WIDTH = 260;
const HEIGHT = 460;

interface Props {
  item: DimItem;
  anchor: DOMRect;
}

// One card the grid moves around, since a tooltip per tile would be a thousand of them
export const HoverCard = (props: Props) => {
  const position = createMemo(() => {
    const room = window.innerWidth - props.anchor.right;
    const left =
      room > WIDTH + GAP
        ? props.anchor.right + GAP
        : props.anchor.left - WIDTH - GAP;

    return {
      left: `${Math.max(GAP, left)}px`,
      top: `${Math.max(
        GAP,
        Math.min(props.anchor.top, window.innerHeight - HEIGHT),
      )}px`,
      width: `${WIDTH}px`,
    };
  });

  return (
    <aside class="hover-card" style={position()}>
      <ItemHead item={props.item} />
      <Stats item={props.item} />
      <Perks item={props.item} />
    </aside>
  );
};
