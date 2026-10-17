import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  type JSX,
} from "solid-js";

import type { ArmorSet, Entry } from "../core/collections/types.ts";
import type { SearchEngine } from "../core/search/search.ts";
import {
  forgetSearch,
  recentSearches,
  rememberSearch,
} from "../core/search/searches.ts";
import { BungieImage } from "./BungieImage.tsx";
import { SearchField } from "./lib/SearchField.tsx";
import { LABEL } from "./lib/text.ts";
import { Button } from "./lib/zaidan/button.tsx";
import { X } from "./lib/zaidan/icons.tsx";

interface Props {
  query: string;
  placeholder: string;
  engine: SearchEngine;
  onQuery: (value: string) => void;
  onPreview?: (value: string | undefined) => void;
  entries?: (query: string) => (Entry | ArmorSet)[];
  onEntry?: (entry: Entry | ArmorSet) => void;
  onSubmit?: (query: string) => void;
  onFocus?: () => void;
  trailing?: JSX.Element;
  class?: string;
  inputClass?: string;
}

interface Row {
  query: string;
  help: string | undefined;
  range: [number, number] | undefined;
  recent: boolean;
}

const COMPLETIONS = 6;

const RECENTS = 3;

const ENTRIES = 3;

const ROW = "flex cursor-pointer gap-2 rounded-md px-2 py-1.5";

interface OptionProps {
  class: string;
  highlighted: boolean;
  onHighlight: () => void;
  onChoose: () => void;
  children: JSX.Element;
}

const Option = (props: OptionProps) => (
  <li
    role="option"
    aria-selected={props.highlighted}
    class={`${ROW} ${props.class}`}
    classList={{ "bg-accent": props.highlighted }}
    onMouseDown={(event) => event.preventDefault()}
    onMouseEnter={() => props.onHighlight()}
    onClick={() => props.onChoose()}
  >
    {props.children}
  </li>
);

export const SearchBar = (props: Props) => {
  const [open, setOpen] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [caret, setCaret] = createSignal(0);
  const [highlight, setHighlight] = createSignal(-1);
  const [remembered, setRemembered] = createSignal(
    recentSearches(props.engine.recents),
  );

  let field: HTMLInputElement | undefined = undefined;

  const completions = createMemo(() =>
    props.query === ""
      ? []
      : props.engine.suggest(props.query, caret()).slice(0, COMPLETIONS),
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

  const entryRows = createMemo(() => {
    const query = props.query.trim();

    if (query.length < 2) {
      return [];
    }

    return props.entries?.(query).slice(0, ENTRIES) ?? [];
  });

  const total = () => rows().length + entryRows().length;

  const highlighted = () => (open() ? rows()[highlight()] : undefined);

  const highlightedEntry = () =>
    open() ? entryRows()[highlight() - rows().length] : undefined;

  const openEntry = (entry: Entry | ArmorSet) => {
    setOpen(false);
    setHighlight(-1);
    props.onEntry?.(entry);
  };

  createEffect(() => props.onPreview?.(highlighted()?.query));

  const suggested = createMemo(() => {
    if (!focused() || caret() !== props.query.length) {
      return "";
    }

    const full = props.engine.completion(props.query, caret());

    return full === undefined ? "" : full.slice(props.query.length);
  });

  const ghost = createMemo(() => {
    const row = highlighted()?.query;

    if (row === undefined) {
      return suggested();
    }

    if (!focused() || caret() !== props.query.length) {
      return "";
    }

    return row.startsWith(props.query) ? row.slice(props.query.length) : "";
  });

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

  // Don't remember typos
  const commit = (query: string) => {
    if (props.engine.valid(query)) {
      setRemembered(rememberSearch(query, props.engine.recents));
    }
  };

  const move = (by: number) => {
    const count = total();

    if (count === 0) {
      return;
    }

    // Cycles through -1 for no highlight
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
      if (highlightedEntry()) {
        return;
      }

      const pick = chosen();

      if (pick !== undefined) {
        event.preventDefault();
        apply(pick);
      }

      return;
    }

    if (event.key === "Enter") {
      const entry = highlightedEntry();

      if (entry) {
        event.preventDefault();
        openEntry(entry);

        return;
      }

      const pick = chosen();

      if (pick !== undefined) {
        event.preventDefault();
        apply(pick);
        commit(pick);

        if (props.onSubmit) {
          setOpen(false);
          props.onSubmit(pick);
        }

        return;
      }

      commit(props.query);
      setOpen(false);
      props.onSubmit?.(props.query);

      return;
    }

    // A search input clears itself on Escape
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
    setRemembered(forgetSearch(query, props.engine.recents));
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
    <SearchField
      ref={(el: HTMLInputElement) => (field = el)}
      wrapper={props.class}
      class={props.inputClass}
      placeholder={ghost() === "" ? props.placeholder : ""}
      value={props.query}
      trailing={props.trailing}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onClick={(event: MouseEvent & { currentTarget: HTMLInputElement }) => {
        setCaret(event.currentTarget.selectionStart ?? props.query.length);
        setOpen(true);
      }}
      onFocus={() => {
        setFocused(true);
        setOpen(true);
        props.onFocus?.();
      }}
      onBlur={onBlur}
      onClear={() => {
        apply("");
        setOpen(false);
      }}
    >
      <Show when={ghost() !== ""}>
        <div
          class={`z-input pointer-events-none absolute inset-0 z-1 flex items-center overflow-hidden border-transparent bg-transparent whitespace-pre text-muted-foreground ${props.inputClass ?? ""}`}
          aria-hidden="true"
        >
          <span class="text-transparent">{props.query}</span>
          {ghost()}
        </div>
      </Show>

      <Show when={open() && total() > 0}>
        <ul
          class="absolute top-full left-0 z-50 mt-1 max-h-[60vh] w-full overflow-y-auto rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10"
          role="listbox"
          onMouseLeave={() => setHighlight(-1)}
        >
          <For each={rows()}>
            {(row, index) => (
              <Option
                class="items-baseline"
                highlighted={highlight() === index()}
                onHighlight={() => setHighlight(index())}
                onChoose={() => apply(row.query)}
              >
                <span class="shrink-0">
                  {parts(row)[0]}
                  <b class="font-medium text-cream">{parts(row)[1]}</b>
                  {parts(row)[2]}
                </span>

                <Show when={row.help}>
                  {(help) => (
                    <span class="line-clamp-2 text-muted-foreground">
                      {help()}
                    </span>
                  )}
                </Show>

                <Show when={row.recent}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="ml-auto self-center text-muted-foreground"
                    aria-label={`Forget ${row.query}`}
                    onMouseDown={(event: MouseEvent) => event.preventDefault()}
                    onClick={(event: MouseEvent) => {
                      event.stopPropagation();
                      drop(row.query);
                    }}
                  >
                    <X />
                  </Button>
                </Show>
              </Option>
            )}
          </For>

          <Show when={entryRows().length > 0}>
            <li
              class={`${LABEL} mt-1 border-t px-2 pt-2 pb-1 first:mt-0 first:border-t-0`}
              role="presentation"
            >
              Collections
            </li>
            <For each={entryRows()}>
              {(entry, index) => (
                <Option
                  class="items-center"
                  highlighted={highlight() === rows().length + index()}
                  onHighlight={() => setHighlight(rows().length + index())}
                  onChoose={() => openEntry(entry)}
                >
                  <BungieImage path={entry.icon} class="size-6" />
                  <span class="flex items-baseline gap-1">
                    <span
                      class={`shrink-0 text-${entry.rarity.toLowerCase()}`}
                    >
                      {entry.name}
                    </span>
                    <span class="line-clamp-2 text-muted-foreground">
                      {entry.kind === "set"
                        ? "Armor set"
                        : `${entry.rarity} ${entry.typeName}`}
                    </span>
                  </span>
                </Option>
              )}
            </For>
          </Show>
        </ul>
      </Show>
    </SearchField>
  );
};
