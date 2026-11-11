import type { DimItem } from "app/inventory/item-types";
import { createMemo, createSignal, For, Index, Show } from "solid-js";

import { newestMark } from "../core/app/autotagger.ts";
import { dropped } from "../core/items/arrivals.ts";
import {
  autotagRules,
  autotagState,
  saveAutotagRules,
  setAutotagEnabled,
  type RuleDraft,
} from "../core/items/autotag.ts";
import { tagDefs } from "../core/items/tags.ts";
import { defs } from "../core/profile/defs.ts";
import { currentStores } from "../core/profile/moves.ts";
import { itemFilter, itemSearch, valid } from "../core/search/search.ts";
import { showToast } from "../core/toast.ts";
import { TagMenu } from "./card/TagControl.tsx";
import { ItemTile } from "./ItemTile.tsx";
import { IconButton } from "./lib/IconButton.tsx";
import { SplitButton } from "./lib/SplitButton.tsx";
import { Toggle } from "./lib/Toggle.tsx";
import { Button } from "./lib/zaidan/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./lib/zaidan/dialog.tsx";
import { ChevronDown, ChevronUp, X } from "./lib/zaidan/icons.tsx";
import { Switch } from "./lib/zaidan/switch.tsx";
import { SearchBar } from "./SearchBar.tsx";

// More than one row's worth at the widest dialog
const SHOWN_MATCHES = 16;

interface Example {
  label: string;
  query: string;
  tagId: string | undefined;
  vault: boolean;
}

const EXAMPLES: Example[] = [
  {
    label: "Keep better copies",
    query: "verdict:better or pvpverdict:better",
    tagId: "keep",
    vault: false,
  },
  {
    label: "Keep top PvE rolls",
    query: "rate:>=a",
    tagId: "pve",
    vault: false,
  },
  {
    label: "Keep top PvP rolls",
    query: "pvprate:>=a",
    tagId: "pvp",
    vault: false,
  },
  {
    label: "Junk worse copies",
    query: "verdict:worse pvpverdict:worse",
    tagId: "junk",
    vault: true,
  },
  {
    label: "Junk spare rolls that miss both columns",
    query: "is:weapon misses:2 is:dupe",
    tagId: "junk",
    vault: true,
  },
];

const problemOf = (draft: RuleDraft): string | undefined => {
  if (draft.query.trim() === "" || !valid(draft.query)) {
    return "Enter a valid search";
  }

  if (draft.tagId === undefined && !draft.vault) {
    return "Set a tag or turn on Send to Vault";
  }

  return undefined;
};

const AutotagRulesContent = (props: { onClose: () => void }) => {
  // The move engine only ever holds the signed-in account
  const stores = currentStores();
  const engine = itemSearch(() => stores, defs);

  const [drafts, setDrafts] = createSignal<RuleDraft[]>(
    autotagRules().map((rule) => ({
      id: rule.id,
      query: rule.query,
      tagId: rule.tagId,
      vault: rule.vault,
      enabled: rule.enabled,
    })),
  );
  const [enabled, setEnabled] = createSignal(!!autotagState()?.enabled);
  const [saving, setSaving] = createSignal(false);

  const update = (id: string, change: Partial<RuleDraft>) =>
    setDrafts(
      drafts().map((draft) =>
        draft.id === id ? { ...draft, ...change } : draft,
      ),
    );

  const shift = (index: number, by: number) => {
    const next = [...drafts()];
    const [moved] = next.splice(index, 1);

    next.splice(index + by, 0, moved!);
    setDrafts(next);
  };

  const add = (example: Example | undefined = undefined) =>
    setDrafts([
      ...drafts(),
      {
        id: crypto.randomUUID(),
        query: example?.query ?? "",
        tagId: example?.tagId,
        vault: example?.vault ?? false,
        enabled: true,
      },
    ]);

  const matches = createMemo(() => {
    const items = stores.flatMap((store) => store.items).filter(dropped);
    const taken = new Set<string>();
    const found = new Map<string, DimItem[]>();

    for (const draft of drafts()) {
      if (draft.query.trim() === "" || !valid(draft.query)) {
        continue;
      }

      const test = itemFilter(draft.query, stores, defs());
      const matched = items.filter((item) => !taken.has(item.id) && test(item));

      if (draft.enabled) {
        for (const item of matched) {
          taken.add(item.id);
        }
      }

      found.set(draft.id, matched);
    }

    return found;
  });

  const blocked = () =>
    drafts().some((draft) => problemOf(draft) !== undefined);

  const save = async () => {
    // With no items every drop already held would count as new
    if (enabled() && stores.every((store) => store.items.length === 0)) {
      showToast("Wait for your inventory to load", "danger");

      return;
    }

    setSaving(true);

    let saved = await saveAutotagRules(drafts());

    if (saved && enabled() !== !!autotagState()?.enabled) {
      saved = await setAutotagEnabled(enabled(), newestMark(stores));
    }

    setSaving(false);

    if (!saved) {
      showToast("Autotag rules didn't save", "danger");

      return;
    }

    props.onClose();
  };

  return (
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Autotag rules</DialogTitle>
        <DialogDescription>
          New drops on a character or in the postmaster take the first rule they
          match
        </DialogDescription>
      </DialogHeader>

      <div class="flex">
        <Toggle label="Autotag" checked={enabled()} onChange={setEnabled} />
      </div>

      <div class="-mx-4 flex max-h-[min(60vh,36rem)] flex-col gap-3 overflow-y-auto px-4">
        <Index
          each={drafts()}
          fallback={
            <div class="flex flex-col gap-1">
              <p class="text-sm text-muted-foreground">Start from an example</p>
              <For each={EXAMPLES}>
                {(example) => (
                  <Button
                    variant="ghost"
                    class="h-auto flex-col items-start gap-0.5 py-2 text-left"
                    onClick={() => add(example)}
                  >
                    {example.label}
                    <span class="font-mono text-xs text-muted-foreground">
                      {example.query}
                    </span>
                  </Button>
                )}
              </For>
            </div>
          }
        >
          {(draft, index) => {
            const shown = () => matches().get(draft().id) ?? [];
            const tag = () => tagDefs().find((def) => def.id === draft().tagId);

            return (
              <section class="flex flex-col gap-3 rounded-md border p-3">
                <header class="flex items-center gap-3">
                  <Switch
                    checked={draft().enabled}
                    onChange={(on: boolean) =>
                      update(draft().id, { enabled: on })
                    }
                    aria-label={`Rule ${index + 1} on`}
                  />
                  <h3 class="shrink-0 font-medium">Rule {index + 1}</h3>
                  <SearchBar
                    class="min-w-0 flex-1"
                    query={draft().query}
                    placeholder="Search items"
                    engine={engine}
                    onQuery={(query) => update(draft().id, { query })}
                  />
                  <div class="flex items-center">
                    <IconButton
                      size="icon-sm"
                      label="Move up"
                      disabled={index === 0}
                      onClick={() => shift(index, -1)}
                    >
                      <ChevronUp />
                    </IconButton>
                    <IconButton
                      size="icon-sm"
                      label="Move down"
                      disabled={index === drafts().length - 1}
                      onClick={() => shift(index, 1)}
                    >
                      <ChevronDown />
                    </IconButton>
                    <IconButton
                      size="icon-sm"
                      label="Remove rule"
                      onClick={() =>
                        setDrafts(
                          drafts().filter((one) => one.id !== draft().id),
                        )
                      }
                    >
                      <X />
                    </IconButton>
                  </div>
                </header>

                <div
                  class="flex flex-col gap-3"
                  classList={{ "opacity-60": !draft().enabled }}
                >
                  <div class="flex items-center gap-6 text-sm">
                    <span class="flex items-center gap-2">
                      Set tag
                      <TagMenu
                        current={tag()}
                        label={tag()?.label ?? "No tag"}
                        onSelect={(tagId) => update(draft().id, { tagId })}
                      />
                    </span>
                    <label class="flex items-center gap-2">
                      Send to Vault
                      <Switch
                        checked={draft().vault}
                        onChange={(vault: boolean) =>
                          update(draft().id, { vault })
                        }
                      />
                    </label>
                    <Show
                      when={problemOf(draft()) === undefined}
                      fallback={
                        <span class="ml-auto text-destructive">
                          {problemOf(draft())}
                        </span>
                      }
                    >
                      <span class="ml-auto text-muted-foreground">
                        {shown().length} owned{" "}
                        {shown().length === 1 ? "match" : "matches"}
                      </span>
                    </Show>
                  </div>

                  <Show when={shown().length > 0}>
                    <div class="grid grid-cols-[repeat(auto-fill,var(--tile))] grid-rows-[auto] auto-rows-[0] gap-x-1 overflow-hidden">
                      <For each={shown().slice(0, SHOWN_MATCHES)}>
                        {(item) => <ItemTile item={item} />}
                      </For>
                    </div>
                  </Show>
                </div>
              </section>
            );
          }}
        </Index>
      </div>

      <DialogFooter class="sm:justify-between">
        <SplitButton
          label="Add rule"
          onPrimary={() => add()}
          choices={EXAMPLES.map((example) => ({
            id: example.label,
            label: example.label,
            onChoose: () => add(example),
          }))}
        />
        <div class="flex gap-2">
          <Button variant="ghost" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button disabled={saving() || blocked()} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
};

/** Rules that tag and vault new drops, saved together */
export const AutotagRules = (props: { open: boolean; onClose: () => void }) => (
  <Dialog
    open={props.open}
    onOpenChange={(open) => {
      if (!open) {
        props.onClose();
      }
    }}
  >
    <Show when={props.open}>
      <AutotagRulesContent onClose={props.onClose} />
    </Show>
  </Dialog>
);
