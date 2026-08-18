import type { DimItem } from "app/inventory/item-types";
import { createEffect, createMemo, createSignal } from "solid-js";

import { Archetype, ItemHead, Perks, SetBonus, Stats } from "./ItemPanel.tsx";

const GAP = 8;
const WIDTH = 260;

interface Props {
  item: DimItem;
  against: DimItem | undefined;
  anchor: DOMRect;
}

// One card the grid moves around, since a tooltip per tile would be a thousand of them
export const HoverCard = (props: Props) => {
  const [height, setHeight] = createSignal(0);

  let card: HTMLElement | undefined = undefined;

  // The card cannot scroll, so anything hanging off the bottom is lost rather than reachable.
  // Reads what this item actually rendered, since a set bonus makes some cards much taller
  createEffect(() => {
    props.item;
    props.against;
    setHeight(card?.offsetHeight ?? 0);
  });

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
        Math.min(props.anchor.top, window.innerHeight - height() - GAP),
      )}px`,
      width: `${WIDTH}px`,
    };
  });

  return (
    <aside class="hover-card" ref={(el) => (card = el)} style={position()}>
      <ItemHead item={props.item} />
      <Archetype item={props.item} />
      <Stats item={props.item} against={props.against} />
      <Perks item={props.item} />
      <SetBonus item={props.item} />
    </aside>
  );
};
