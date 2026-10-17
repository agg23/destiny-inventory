import { For, Show, type JSX } from "solid-js";

import { BungieImage } from "../../components/BungieImage.tsx";
import { LABEL, NOTE_TEXT } from "../../components/lib/text.ts";
import { ARMOR_SLOTS, bySlot } from "../../core/collections/armorSets.ts";
import type { Entry } from "../../core/collections/types.ts";
import { noteFor } from "../../core/items/notes.ts";
import { setBonusOf } from "../../core/items/perks.ts";
import { defs } from "../../core/profile/defs.ts";

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

  const note = () => {
    const first = props.pieces[0];

    return first?.kind === "armor" && first.setKey !== undefined
      ? noteFor({ kind: "set", targetId: first.setKey })
      : undefined;
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
    <div>
      <h4 class={`${LABEL} mb-1 flex items-center gap-1.5`}>
        <span class="min-w-0 truncate">{name()}</span>
        <span class="shrink-0 font-normal tabular-nums">{props.count}</span>
      </h4>
      <div class="grid grid-cols-[repeat(5,var(--tile))] gap-1">
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
          <ul class="mt-2 flex flex-col gap-2 text-xs">
            <For each={found().perks}>
              {(perk) => (
                <li class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2">
                  <BungieImage path={perk.icon} class="size-5" />
                  <div class="col-start-2">
                    <b class="block font-medium text-foreground">
                      {perk.requiredSetCount} piece · {perk.name}
                    </b>
                    <span class="block whitespace-pre-wrap text-muted-foreground">
                      {perk.description}
                    </span>
                  </div>
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
      <Show when={note()}>
        {(found) => (
          <p class={`${NOTE_TEXT} mt-2`}>
            {found()}
          </p>
        )}
      </Show>
    </div>
  );
};
