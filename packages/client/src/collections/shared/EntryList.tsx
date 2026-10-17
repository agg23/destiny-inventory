import { For, Show } from "solid-js";

import { BungieImage } from "../../components/BungieImage.tsx";
import { TABLE_FRAME, TABLE_HEADER } from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { TileRatings } from "../../components/Tile.tsx";
import {
  CATALYST_LABELS,
  STATUS_LABELS,
} from "../../core/collections/labels.ts";
import { sourceLabel } from "../../core/collections/ownership.ts";
import type { Entry } from "../../core/collections/types.ts";
import { catalystState } from "../../core/items/perks.ts";
import type { Kind } from "../../core/url.ts";
import {
  entryNotes,
  useEntryPreview,
  type CollectionData,
} from "./collectionData.ts";
import { damageIcon, entryTiers } from "./CollectionTile.tsx";

const ownershipText = (data: CollectionData, entry: Entry): string => {
  const ownership = data.ownership(entry);
  const copies = data.copiesOf(entry).length;

  if (ownership === undefined) {
    return "";
  }

  return ownership === "owned" && copies > 1
    ? `Owned ×${copies}`
    : STATUS_LABELS[ownership];
};

const catalystText = (data: CollectionData, entry: Entry): string => {
  const catalyst = data.catalyst(entry);
  const state = catalystState(catalyst, catalyst?.objectives ?? []);

  return state === undefined ? "" : CATALYST_LABELS[state];
};

/** The list view's table */
export const EntryList = (props: {
  kind: Kind;
  entries: Entry[];
  data: CollectionData;
  onOpen: (entry: Entry) => void;
}) => {
  const hover = useEntryPreview();

  return (
    <div class={TABLE_FRAME}>
      <Table class="collections-table">
        <TableHeader class={TABLE_HEADER}>
          <TableRow>
            <TableHead class="w-12" />
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <Show when={props.kind === "armor"}>
              <TableHead>Set</TableHead>
            </Show>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <Show when={props.kind === "weapon"}>
              <TableHead>Catalyst</TableHead>
              <TableHead>Aegis</TableHead>
            </Show>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={props.entries}>
            {(entry) => (
              <TableRow
                class="cursor-pointer"
                classList={{
                  "opacity-50": props.data.ownership(entry) === "neverseen",
                }}
                onClick={() => props.onOpen(entry)}
              >
                <TableCell
                  class="py-1"
                  onMouseEnter={(e) =>
                    hover.enter(
                      entry,
                      e.currentTarget,
                      entryNotes(
                        props.data.ownership(entry),
                        props.data.copiesOf(entry).length,
                      ),
                    )
                  }
                  onMouseLeave={() => hover.leave()}
                >
                  <BungieImage
                    path={entry.icon}
                    class="size-8 max-w-none"
                    lazy
                  />
                </TableCell>
                <TableCell class={`text-${entry.rarity.toLowerCase()}`}>
                  {entry.name}
                </TableCell>
                <TableCell>
                  <span class="inline-flex items-center gap-1.5">
                    <BungieImage path={damageIcon(entry)} class="size-4" />
                    {entry.typeName}
                  </span>
                </TableCell>
                <Show when={props.kind === "armor"}>
                  <TableCell class="whitespace-normal text-muted-foreground">
                    {entry.kind === "armor" ? (entry.setName ?? "") : ""}
                  </TableCell>
                </Show>
                <TableCell class="whitespace-normal text-muted-foreground">
                  {sourceLabel(entry.sources[0] ?? "")}
                </TableCell>
                <TableCell
                  classList={{
                    "text-cream": props.data.ownership(entry) === "owned",
                    "text-muted-foreground":
                      props.data.ownership(entry) === "neverseen",
                  }}
                >
                  {ownershipText(props.data, entry)}
                </TableCell>
                <Show when={props.kind === "weapon"}>
                  <TableCell>{catalystText(props.data, entry)}</TableCell>
                  <TableCell>
                    <TileRatings tiers={(mode) => entryTiers(entry, mode)} />
                  </TableCell>
                </Show>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>
    </div>
  );
};
