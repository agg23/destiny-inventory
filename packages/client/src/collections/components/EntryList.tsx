import { For, Show } from "solid-js";

import { BUNGIE } from "../../bungie.ts";
import { sourceLabel, type Entry } from "../../collections.ts";
import type { Kind } from "../../url.ts";
import type { CollectionData } from "../collectionData.ts";
import { damageIcon, weaponTier } from "./CollectionTile.tsx";

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
  <table class="table collections-table">
    <thead>
      <tr>
        <th />
        <th>Name</th>
        <th>Type</th>
        <Show when={props.kind === "armor"}>
          <th>Set</th>
        </Show>
        <th>Source</th>
        <th>Status</th>
        <Show when={props.kind === "weapon"}>
          <th>Catalyst</th>
          <th>Aegis</th>
        </Show>
      </tr>
    </thead>
    <tbody>
      <For each={props.entries}>
        {(entry) => (
          <tr
            classList={{
              neverseen: props.data.ownership(entry) === "neverseen",
            }}
            onClick={() => props.onOpen(entry)}
          >
            <td
              class="collections-table-icon"
              onMouseEnter={(e) => props.onEnter(entry, e.currentTarget)}
              onMouseLeave={() => props.onLeave()}
            >
              <img src={`${BUNGIE}${entry.icon}`} loading="lazy" alt="" />
            </td>
            <td class={`text-${entry.rarity.toLowerCase()}`}>{entry.name}</td>
            <td>
              <span class="collections-type">
                <Show when={damageIcon(entry)}>
                  {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
                </Show>
                {entry.typeName}
              </span>
            </td>
            <Show when={props.kind === "armor"}>
              <td class="text-muted">
                {entry.kind === "armor" ? (entry.setName ?? "") : ""}
              </td>
            </Show>
            <td class="text-muted">{sourceLabel(entry.sources[0] ?? "")}</td>
            <td
              classList={{
                "text-gold": props.data.ownership(entry) === "owned",
                "text-muted": props.data.ownership(entry) === "neverseen",
              }}
            >
              {ownershipText(props.data, entry)}
            </td>
            <Show when={props.kind === "weapon"}>
              <td>{catalystText(props.data, entry)}</td>
              <td>
                <Show when={weaponTier(entry)}>
                  {(tier) => (
                    <span class={`tier-chip tier-${tier().toLowerCase()}`}>
                      {tier()}
                    </span>
                  )}
                </Show>
              </td>
            </Show>
          </tr>
        )}
      </For>
    </tbody>
  </table>
);
