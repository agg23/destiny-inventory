import { For, Show } from "solid-js";

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
import { BUNGIE } from "../../core/api/bungie.ts";
import { sourceLabel } from "../../core/collections/ownership.ts";
import type { Entry } from "../../core/collections/types.ts";
import type { Kind } from "../../core/url.ts";
import type { CollectionData } from "./collectionData.ts";
import { damageIcon, entryTiers } from "./CollectionTile.tsx";

const ownershipText = (data: CollectionData, entry: Entry): string => {
  const copies = data.copiesOf(entry).length;

  switch (data.ownership(entry)) {
    case "owned":
      return copies > 1 ? `Owned ×${copies}` : "Owned";
    case "unlocked":
      return "Unlocked";
    case "neverseen":
      return "Never seen";
    default:
      return "";
  }
};

const catalystText = (data: CollectionData, entry: Entry): string => {
  const catalyst = data.catalyst(entry);

  if (!catalyst) {
    return "";
  }

  if (catalyst.complete) {
    return "Complete";
  }

  return catalyst.unlocked ? "Obtained" : "Missing";
};

/** The list view's table, with set columns for armor and catalyst columns for weapons */
export const EntryList = (props: {
  kind: Kind;
  entries: Entry[];
  data: CollectionData;
  onOpen: (entry: Entry) => void;
  onEnter: (entry: Entry, element: HTMLElement) => void;
  onLeave: () => void;
}) => (
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
                onMouseEnter={(e) => props.onEnter(entry, e.currentTarget)}
                onMouseLeave={() => props.onLeave()}
              >
                <img
                  class="size-8 max-w-none"
                  src={`${BUNGIE}${entry.icon}`}
                  loading="lazy"
                  alt=""
                />
              </TableCell>
              <TableCell class={`text-${entry.rarity.toLowerCase()}`}>
                {entry.name}
              </TableCell>
              <TableCell>
                <span class="inline-flex items-center gap-1.5">
                  <Show when={damageIcon(entry)}>
                    {(icon) => (
                      <img class="size-4" src={`${BUNGIE}${icon()}`} alt="" />
                    )}
                  </Show>
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
