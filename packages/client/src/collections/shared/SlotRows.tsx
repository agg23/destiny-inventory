import { For, type JSX } from "solid-js";

import { LABEL, TILE_GRID } from "../../components/lib/text.ts";
import type { Entry } from "../../core/collections/types.ts";
import { defs } from "../../core/profile/defs.ts";

const bucketName = (hash: number): string =>
  defs()?.InventoryBucket.getOptional(hash)?.displayProperties.name ?? "";

/** One labeled row of tiles per slot that holds anything */
export const SlotRows = (props: {
  slots: number[];
  entries: Entry[];
  tile: (entry: Entry) => JSX.Element;
}) => (
  <For
    each={props.slots.filter((slot) =>
      props.entries.some((entry) => entry.bucketHash === slot),
    )}
  >
    {(slot) => (
      <div class="border-t py-1 first:border-t-0">
        <h4 class={`${LABEL} mb-1`}>{bucketName(slot)}</h4>
        <div class={TILE_GRID}>
          <For
            each={props.entries.filter((entry) => entry.bucketHash === slot)}
          >
            {props.tile}
          </For>
        </div>
      </div>
    )}
  </For>
);
