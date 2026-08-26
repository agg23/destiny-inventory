import type { NameEntry } from "@dvm/defs-core";
import { createResource, For, Show } from "solid-js";

import { BUNGIE } from "./bungie.ts";
import { fakeItems } from "./fakeItems.ts";
import { typeName } from "./ItemPanel.tsx";
import type { LoadResult } from "./load.ts";
import { searchNames } from "./names.ts";
import { clear, preview } from "./preview.ts";

interface Props {
  query: string;
  loaded: LoadResult | undefined;
  onOpen: (hash: number) => void;
}

const ROWS = 3;

export const ItemMatches = (props: Props) => {
  const [entries] = createResource(
    () => {
      const index = props.loaded?.session.index;

      return index === undefined ? undefined : { index, query: props.query };
    },
    ({ index, query }) => searchNames(index, query, ROWS),
  );

  const [items] = createResource(
    () => {
      const loaded = props.loaded;
      const hashes = (entries() ?? []).map((entry) => entry.hash);

      return loaded && hashes.length > 0 ? { loaded, hashes } : undefined;
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
  );

  const itemFor = (entry: NameEntry) => items()?.get(entry.hash);

  // An item with no type display name reads as Unknown
  const kind = (entry: NameEntry): string | undefined => {
    const item = itemFor(entry);

    if (!item || item.typeName === "Unknown") {
      return undefined;
    }

    return typeName(item);
  };

  return (
    <For each={entries() ?? []}>
      {(entry) => (
        <li
          class="search-row item-match selectable"
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={(event) => {
            const item = itemFor(entry);

            if (item) {
              preview(item, event.currentTarget);
            }
          }}
          onMouseLeave={() => clear()}
          onClick={() => props.onOpen(entry.hash)}
        >
          <Show when={itemFor(entry)?.icon}>
            {(icon) => (
              <img class="item-match-icon" src={`${BUNGIE}${icon()}`} alt="" />
            )}
          </Show>
          <span class="search-row-query">{entry.name}</span>
          <Show when={kind(entry)}>
            {(label) => <span class="search-row-help">{label()}</span>}
          </Show>
        </li>
      )}
    </For>
  );
};
