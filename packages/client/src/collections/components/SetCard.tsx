import { For, Show, type JSX } from "solid-js";

import { BUNGIE } from "../../bungie.ts";
import type { Entry } from "../../collections.ts";
import { defs } from "../../defs.ts";
import { setBonusOf } from "../../perks.ts";
import { ARMOR_SLOTS, bySlot } from "../armorSets.ts";

/** One armor set: its pieces placed by slot, then the full set bonus */
export const SetCard = (props: {
  pieces: Entry[];
  count: string;
  tile: (entry: Entry) => JSX.Element;
}) => {
  const name = () => {
    const first = props.pieces[0];

    return first?.kind === "armor" ? (first.setName ?? "") : "";
  };

  const bonus = () => {
    const setHash = props.pieces.flatMap((piece) =>
      piece.kind === "armor" && piece.itemSetHash !== undefined
        ? [piece.itemSetHash]
        : [],
    )[0];
    const set =
      setHash === undefined
        ? undefined
        : defs()?.EquipableItemSet.getOptional(setHash);

    return set ? setBonusOf(set) : undefined;
  };

  return (
    <div class="collections-set">
      <h4 class="bucket-label">
        <span class="collections-set-name">{name()}</span>
        <span class="text-muted">{props.count}</span>
      </h4>
      <div class="item-grid">
        <For each={bySlot(props.pieces)}>
          {(piece) => (
            <div
              style={{
                "grid-column": ARMOR_SLOTS.indexOf(piece.bucketHash) + 1,
              }}
            >
              {props.tile(piece)}
            </div>
          )}
        </For>
      </div>
      <Show when={bonus()}>
        {(found) => (
          <ul class="collections-set-bonus">
            <For each={found().perks}>
              {(perk) => (
                <li>
                  <Show when={perk.icon}>
                    {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
                  </Show>
                  <div>
                    <b>
                      {perk.requiredSetCount} piece · {perk.name}
                    </b>
                    <span>{perk.description}</span>
                  </div>
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
    </div>
  );
};
