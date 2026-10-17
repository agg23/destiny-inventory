import { useLocation, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";

import { SEARCHES } from "../../collections/shared/collectionSearch.ts";
import type { ArmorSet, Entry } from "../../core/collections/types.ts";
import type { LoadResult } from "../../core/profile/loadTypes.ts";
import { vaultable } from "../../core/profile/moveTargets.ts";
import type { Url } from "../../core/router.ts";
import type { SearchEngine } from "../../core/search/search.ts";
import {
  collectionsHref,
  entryHref,
  type Kind,
  type Tab,
} from "../../core/url.ts";
import { SearchField } from "../lib/SearchField.tsx";
import { SearchBar } from "../SearchBar.tsx";

const KIND_SCOPES: Record<Kind, string> = {
  weapon: "Filter weapons",
  armor: "Filter armor",
};

const FILTER = "min-w-32 flex-1";

// Nova has no small Input; this is its 28px control size
const FILTER_INPUT = "h-7 py-0.5";

const SCOPES: Record<Tab, string> = {
  vault: "Filter items",
  triage: "Filter items",
  collections: "Filter weapons",
  activities: "Filter activities",
  todo: "Filter todos",
  history: "Filter runs",
};

interface Props {
  url: Url;
  tab: Tab;
  filtersItems: boolean;
  query: string;
  loaded: LoadResult | undefined;
  shown: number;
  engine: SearchEngine;
  entries: (query: string) => (Entry | ArmorSet)[];
  onQuery: (value: string) => void;
  onPreview: (value: string | undefined) => void;
  onSet: (set: ArmorSet) => void;
  onFocus: () => void;
}

export const HeaderSearch = (props: Props) => {
  const navigate = useNavigate();
  const location = useLocation();

  const itemCount = () => {
    const loaded = props.loaded;

    if (!loaded || props.query === "") {
      return undefined;
    }

    const notes = [
      loaded.counts.hidden > 0 ? `${loaded.counts.hidden} hidden` : "",
      loaded.counts.skipped > 0 ? `${loaded.counts.skipped} skipped` : "",
    ].filter((note) => note !== "");

    return (
      <span title={notes.length > 0 ? notes.join(" · ") : undefined}>
        {props.shown} of {loaded.items.filter(vaultable).length}
      </span>
    );
  };

  return (
      <Show
        when={props.filtersItems}
        fallback={
          <Show
            when={props.tab === "collections"}
            fallback={
              <SearchField
                wrapper={FILTER}
                class={FILTER_INPUT}
                placeholder={SCOPES[props.tab]}
                value={props.query}
                onInput={(e) => props.onQuery(e.currentTarget.value)}
                onClear={() => props.onQuery("")}
              />
            }
          >
            <SearchBar
              class={FILTER}
              inputClass={FILTER_INPUT}
              query={props.query}
              placeholder={KIND_SCOPES[props.url.get("kind")]}
              engine={SEARCHES[props.url.get("kind")]}
              onQuery={props.onQuery}
              entries={props.entries}
              onEntry={(entry) =>
                entry.kind === "set"
                  ? props.onSet(entry)
                  : navigate(
                      entryHref(entry.newestItemHash, {
                        kind: entry.kind,
                        by: props.url.get("by"),
                        layout: props.url.get("layout"),
                        q: props.query,
                      }),
                    )
              }
              onSubmit={(query) => {
                if (location.pathname.startsWith("/collections/")) {
                  navigate(
                    collectionsHref("/collections", {
                      kind: props.url.get("kind"),
                      by: props.url.get("by"),
                      layout: props.url.get("layout"),
                      q: query,
                    }),
                  );
                }
              }}
              onFocus={props.onFocus}
            />
          </Show>
        }
      >
        <SearchBar
          class={FILTER}
          inputClass={FILTER_INPUT}
          query={props.query}
          placeholder={SCOPES.vault}
          engine={props.engine}
          trailing={itemCount()}
          onQuery={props.onQuery}
          onPreview={props.onPreview}
          entries={props.entries}
          onEntry={(entry) =>
            entry.kind === "set"
              ? props.onSet(entry)
              : navigate(
                  entryHref(entry.newestItemHash, { kind: entry.kind }),
                )
          }
          onFocus={props.onFocus}
        />
      </Show>
  );
};
