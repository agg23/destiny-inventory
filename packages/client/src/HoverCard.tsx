import type { DimItem } from "app/inventory/item-types";
import { Show } from "solid-js";

import type { Verdict } from "./arrivals.ts";
import { ItemDetails, ItemHead } from "./ItemPanel.tsx";
import { AnchoredPanel } from "./ui/AnchoredPanel.tsx";

interface Props {
  item: DimItem;
  against: DimItem | undefined;
  verdict: Verdict | undefined;
  cursorX: number | undefined;
}

const RivalNote = (props: { verdict: Verdict }) => (
  <Show when={props.verdict.gains.length + props.verdict.losses.length > 0}>
    <div class="tooltip-body">
      <div class="aegis-note">
        <p class="aegis-line">
          <span class="aegis-lead">
            <b class="tracking-wide uppercase">Compared to the best instance</b>
          </span>
        </p>
        <ul class="aegis-slots">
          <Show when={props.verdict.gains.length > 0}>
            <li class="hit">
              <span class="aegis-slot-label">Has</span>
              <span class="aegis-slot-perk">
                {props.verdict.gains.join(", ")}
              </span>
            </li>
          </Show>
          <Show when={props.verdict.losses.length > 0}>
            <li class="miss">
              <span class="aegis-slot-label">Lacks</span>
              <span class="aegis-slot-perk">
                {props.verdict.losses.join(", ")}
              </span>
            </li>
          </Show>
        </ul>
      </div>
    </div>
  </Show>
);

export const HoverCard = (props: Props) => (
  <AnchoredPanel class="item-tooltip hover-card" cursorX={props.cursorX}>
    <ItemHead item={props.item} />
    <Show when={props.verdict}>
      {(verdict) => <RivalNote verdict={verdict()} />}
    </Show>
    <ItemDetails item={props.item} against={props.against} />
  </AnchoredPanel>
);
