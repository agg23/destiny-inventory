import type { DimItem } from "app/inventory/item-types";
import { createEffect, createMemo, createSignal, Show } from "solid-js";

import {
  Archetype,
  ItemHead,
  ItemPower,
  Perks,
  SetBonus,
  Stats,
} from "./ItemPanel.tsx";

const GAP = 8;
// The framework's own tooltip width
const WIDTH = 352;

interface Props {
  item: DimItem;
  against: DimItem | undefined;
  anchor: DOMRect;
}

export const HoverCard = (props: Props) => {
  const [height, setHeight] = createSignal(0);

  let card: HTMLElement | undefined = undefined;

  // The card cannot scroll
  createEffect(() => {
    props.item;
    props.against;
    setHeight(card?.offsetHeight ?? 0);
  });

  // An uninstanced item carries no roll
  const uninstanced = () => props.item.id === "0";

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
    <aside
      class="item-tooltip hover-card"
      ref={(el) => (card = el)}
      style={position()}
    >
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
    </aside>
  );
};
