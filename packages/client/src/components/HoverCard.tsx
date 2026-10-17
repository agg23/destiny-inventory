import type { DimItem } from "app/inventory/item-types";
import { Show } from "solid-js";

import type { Catalyst } from "../core/collections/collections.ts";
import { verdictMode, type ModeVerdict } from "../core/items/arrivals.ts";
import { noteFor } from "../core/items/notes.ts";
import type { CardCost } from "../core/items/preview.ts";
import { ItemDetails, ItemHead, VERDICT_ROW } from "./ItemPanel.tsx";
import { AnchoredPanel } from "./lib/AnchoredPanel.tsx";

interface Props {
  item: DimItem;
  against: DimItem | undefined;
  verdict: ModeVerdict | undefined;
  cursorX: number | undefined;
  rollWarning: boolean;
  notes: string[];
  cost: CardCost | undefined;
  catalyst: Catalyst | undefined;
}

const RivalNote = (props: { verdict: ModeVerdict }) => (
  <Show when={props.verdict.gains.length + props.verdict.losses.length > 0}>
    <div class="tooltip-body flex flex-col gap-1.5">
      <b class="font-medium text-foreground">
        Compared to the best instance
        <Show when={verdictMode(props.verdict)}>
          {(mode) => <> in {mode()}</>}
        </Show>
      </b>
      <ul class="flex flex-col gap-1.5 text-xs">
        <Show when={props.verdict.gains.length > 0}>
          <li class={VERDICT_ROW}>
            <span class="text-good">Has</span>
            <span>{props.verdict.gains.join(", ")}</span>
          </li>
        </Show>
        <Show when={props.verdict.losses.length > 0}>
          <li class={VERDICT_ROW}>
            <span class="text-destructive">Lacks</span>
            <span>{props.verdict.losses.join(", ")}</span>
          </li>
        </Show>
      </ul>
    </div>
  </Show>
);

export const HoverCard = (props: Props) => (
  <AnchoredPanel class="item-tooltip hover-card" cursorX={props.cursorX}>
    <ItemHead
      item={props.item}
      taggable
      notes={props.notes}
      cost={props.cost}
    />
    <Show
      when={
        props.item.id !== "0" &&
        noteFor({ kind: "instance", targetId: props.item.id })
      }
    >
      {(note) => (
        <div class="tooltip-body">
          <p class="line-clamp-3 whitespace-pre-wrap wrap-anywhere">
            {note()}
          </p>
        </div>
      )}
    </Show>
    <Show when={props.verdict}>
      {(verdict) => <RivalNote verdict={verdict()} />}
    </Show>
    <ItemDetails
      item={props.item}
      against={props.against}
      hideRollWarning={!props.rollWarning}
      catalyst={props.catalyst}
    />
  </AnchoredPanel>
);
