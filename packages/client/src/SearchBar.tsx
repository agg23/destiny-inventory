import type { DimStore } from "app/inventory/store-types";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { defs } from "./defs.ts";
import { completion, suggest, valid } from "./search.ts";
import { forgetSearch, recentSearches, rememberSearch } from "./searches.ts";

interface Props {
  query: string;
  stores: DimStore[];
  onQuery: (value: string) => void;
  onPreview: (value: string | undefined) => void;
}

interface Row {
  query: string;
  help: string | undefined;
  range: [number, number] | undefined;
  recent: boolean;
}

const COMPLETIONS = 6;

const RECENTS = 3;

export const SearchBar = (props: Props) => {
  const [open, setOpen] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [caret, setCaret] = createSignal(0);
  const [highlight, setHighlight] = createSignal(-1);
  const [remembered, setRemembered] = createSignal(recentSearches());

  let field: HTMLInputElement | undefined = undefined;

  const completions = createMemo(() =>
    props.query === ""
      ? []
      : suggest(props.query, caret(), props.stores, defs()).slice(
          0,
          COMPLETIONS,
        ),
  );

  const rows = createMemo<Row[]>(() => {
    const completed = completions().map((suggestion) => ({
      query: suggestion.query,
      help: suggestion.help,
      range: suggestion.range,
      recent: false,
    }));

    const needle = props.query.trim().toLowerCase();
    const taken = new Set(completed.map((row) => row.query));

    const past = remembered()
      .filter(
        (entry) =>
          !taken.has(entry) &&
          entry !== props.query &&
          entry.toLowerCase().includes(needle),
      )
      .slice(0, needle === "" ? COMPLETIONS + RECENTS : RECENTS)
      .map((entry) => ({
        query: entry,
        help: undefined,
        range: undefined,
        recent: true,
      }));

    return [...completed, ...past];
  });

  const highlighted = () => (open() ? rows()[highlight()] : undefined);

  // Arrow keys walk the list without touching the query, so the grid follows the highlight
  createEffect(() => props.onPreview(highlighted()?.query));

  // Only trails the caret, so an edit in the middle of a query gets no ghost
  const suggested = () => {
    if (!focused() || caret() !== props.query.length) {
      return "";
    }

    const full = completion(props.query, caret(), props.stores, defs());

    return full === undefined ? "" : full.slice(props.query.length);
  };

  // A walked row shows in the box without being committed, so dropping the highlight puts the
  // default completion back
  const ghost = () => {
    const row = highlighted()?.query;

    if (row === undefined) {
      return suggested();
    }

    if (!focused() || caret() !== props.query.length) {
      return "";
    }

    return row.startsWith(props.query) ? row.slice(props.query.length) : "";
  };

  // What a commit takes: the row being walked, or else the default completion
  const chosen = (): string | undefined => {
    const row = highlighted();

    if (row) {
      return row.query;
    }

    return suggested() === "" ? undefined : props.query + suggested();
  };

  const put = (query: string) => {
    props.onQuery(query);
    setCaret(query.length);
    setHighlight(-1);
  };

  const apply = (query: string) => {
    put(query);
    field?.focus();
  };

  // A typo is not worth offering back, so only a query that parses is kept
  const commit = (query: string) => {
    if (valid(query)) {
      setRemembered(rememberSearch(query));
    }
  };

  const move = (by: number) => {
    const count = rows().length;

    if (count === 0) {
      return;
    }

    // Nothing highlighted is -1, so the cycle runs over one extra slot
    setHighlight((was) => ((was + by + count + 2) % (count + 1)) - 1);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      move(1);

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);

      return;
    }

    if (event.key === "Tab" || event.key === "ArrowRight") {
      const pick = chosen();

      if (pick !== undefined) {
        event.preventDefault();
        apply(pick);
      }

      return;
    }

    if (event.key === "Enter") {
      const pick = chosen();

      if (pick !== undefined) {
        event.preventDefault();
        apply(pick);
        commit(pick);

        return;
      }

      commit(props.query);
      setOpen(false);

      return;
    }

    // A search input clears itself on Escape, which is only wanted once the list is gone
    if (event.key === "Escape") {
      if (open()) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);

        return;
      }

      if (props.query !== "") {
        event.stopPropagation();
      }
    }
  };

  const onInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    const value = event.currentTarget.value;

    setCaret(event.currentTarget.selectionStart ?? value.length);
    setHighlight(-1);
    setOpen(true);
    props.onQuery(value);
  };

  // Leaving the field settles the search on whatever the ghost was offering
  const onBlur = () => {
    const completed = props.query + suggested();

    setFocused(false);
    setOpen(false);

    if (completed !== props.query) {
      put(completed);
    }

    commit(completed);
  };

  const drop = (query: string) => {
    setRemembered(forgetSearch(query));
    field?.focus();
  };

  const parts = (row: Row): [string, string, string] =>
    row.range === undefined
      ? [row.query, "", ""]
      : [
          row.query.slice(0, row.range[0]),
          row.query.slice(row.range[0], row.range[1]),
          row.query.slice(row.range[1]),
        ];

  return (
    <div class="search-field" data-menu>
      <input
        ref={(el) => (field = el)}
        class="text-input inline"
        type="search"
        placeholder={ghost() === "" ? "Filter" : ""}
        autocomplete="off"
        spellcheck={false}
        value={props.query}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          setCaret(event.currentTarget.selectionStart ?? props.query.length);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={onBlur}
      />

      <Show when={ghost() !== ""}>
        <div class="text-input inline search-ghost" aria-hidden="true">
          <span>{props.query}</span>
          {ghost()}
        </div>
      </Show>

      <Show when={open() && rows().length > 0}>
        <ul
          class="picker-menu search-menu"
          role="listbox"
          onMouseLeave={() => setHighlight(-1)}
        >
          <For each={rows()}>
            {(row, index) => (
              <li
                role="option"
                aria-selected={highlight() === index()}
                class="search-row selectable"
                classList={{ active: highlight() === index() }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index())}
                onClick={() => apply(row.query)}
              >
                <span class="search-row-query">
                  {parts(row)[0]}
                  <b>{parts(row)[1]}</b>
                  {parts(row)[2]}
                </span>

                <Show when={row.help}>
                  {(help) => <span class="search-row-help">{help()}</span>}
                </Show>

                <Show when={row.recent}>
                  <button
                    class="search-row-drop"
                    type="button"
                    aria-label={`Forget ${row.query}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      drop(row.query);
                    }}
                  >
                    ×
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
};
