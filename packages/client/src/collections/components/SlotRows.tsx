import { For, type JSX } from "solid-js";

import type { Entry } from "../../collections.ts";
import { defs } from "../../defs.ts";

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
      <div class="collections-slot">
        <h4 class="bucket-label">{bucketName(slot)}</h4>
        <div class="item-grid">
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
