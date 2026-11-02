import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  untrack,
} from "solid-js";

import type { Stance } from "@dvm/service";

import {
  definedSession,
  primeCollections,
} from "../core/collections/collections.ts";
import {
  primeWeaponPerks,
  weaponTraits,
} from "../core/collections/weaponPerks.ts";
import { messageOf } from "../core/error.ts";
import {
  perkStances,
  savePerkStances,
  type Stances,
} from "../core/items/perkPreferences.ts";
import { MODE_NAMES, MODES, type Mode } from "../core/items/rollTypes.ts";
import type { LoadResult } from "../core/profile/loadTypes.ts";
import { showToast } from "../core/toast.ts";
import { PerkIcon } from "./card/PerkRow.tsx";
import { Loading } from "./lib/Loading.tsx";
import { SearchField } from "./lib/SearchField.tsx";
import { Select } from "./lib/Select.tsx";
import { Button } from "./lib/zaidan/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./lib/zaidan/dialog.tsx";
import { ThumbsDown, ThumbsUp } from "./lib/zaidan/icons.tsx";
import { ToggleGroup, ToggleGroupItem } from "./lib/zaidan/toggle-group.tsx";

const ROW = "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3";

const SORTS = ["name", "modified"] as const;

const SORT_NAMES = { name: "Name", modified: "Modified" };

interface Props {
  loaded: LoadResult | undefined;
  onClose: () => void;
}

const PerkPreferencesContent = (props: Props) => {
  const [draft, setDraft] = createSignal<Stances>(perkStances());
  const [query, setQuery] = createSignal("");
  const [sort, setSort] = createSignal<(typeof SORTS)[number]>("modified");
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    const session = definedSession(props.loaded?.session);

    if (session && !weaponTraits()) {
      primeCollections(session)
        .then((index) => primeWeaponPerks(session, index))
        .catch((e: unknown) => showToast(messageOf(e), "danger"));
    }
  });

  const shown = createMemo(() => {
    const needle = query().trim().toLowerCase();
    const matching = (weaponTraits() ?? []).filter((trait) =>
      trait.name.toLowerCase().includes(needle),
    );

    if (sort() === "name") {
      return matching;
    }

    // Draft as of the last sort or search, so rows don't jump while toggling
    const stances = untrack(draft);
    const isModified = (name: string) =>
      MODES.some((mode) => stances[mode].has(name));

    return [
      ...matching.filter((trait) => isModified(trait.name)),
      ...matching.filter((trait) => !isModified(trait.name)),
    ];
  });

  const setStance = (mode: Mode, perk: string, stance: Stance | undefined) => {
    const next = new Map(draft()[mode]);

    if (stance) {
      next.set(perk, stance);
    } else {
      next.delete(perk);
    }

    setDraft({ ...draft(), [mode]: next });
  };

  const save = async () => {
    setSaving(true);

    const saved = await savePerkStances(draft());

    setSaving(false);

    if (!saved) {
      showToast("Perk preferences didn't save", "danger");

      return;
    }

    props.onClose();
  };

  return (
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Perk preferences</DialogTitle>
        <DialogDescription>
          Mark a perk as desirable or undesirable
        </DialogDescription>
      </DialogHeader>

      <div class="flex items-center gap-4">
        <SearchField
          wrapper="flex-1"
          placeholder="Search perks"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          onClear={() => setQuery("")}
        />
        <Select
          label="Sort"
          value={sort()}
          options={SORTS}
          names={SORT_NAMES}
          onChange={setSort}
        />
      </div>

      <Show when={weaponTraits()} fallback={<Loading label="Loading perks" />}>
        <div class="-mx-4 flex h-[min(60vh,32rem)] flex-col overflow-y-auto px-4">
          <div
            class={`${ROW} sticky top-0 z-1 bg-popover pb-1 text-xs text-muted-foreground`}
          >
            <span />
            <For each={MODES}>
              {(mode) => (
                <span class="w-14 text-center">{MODE_NAMES[mode]}</span>
              )}
            </For>
          </div>

          <For
            each={shown()}
            fallback={
              <p class="py-4 text-center text-muted-foreground">No perks</p>
            }
          >
            {(trait) => (
              <div class={`${ROW} py-1`}>
                <span class="flex min-w-0 items-center gap-2">
                  <PerkIcon icon={trait.icon} />
                  <span class="truncate">{trait.name}</span>
                </span>
                <For each={MODES}>
                  {(mode) => (
                    <ToggleGroup
                      variant="outline"
                      size="sm"
                      value={draft()[mode].get(trait.name) ?? null}
                      onChange={(next: string | null) =>
                        setStance(
                          mode,
                          trait.name,
                          (next ?? undefined) as Stance | undefined,
                        )
                      }
                    >
                      <ToggleGroupItem
                        value="up"
                        class="px-0! data-pressed:text-good"
                        aria-label={`Like for ${MODE_NAMES[mode]}`}
                      >
                        <ThumbsUp />
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="down"
                        class="px-0! data-pressed:text-destructive"
                        aria-label={`Dislike for ${MODE_NAMES[mode]}`}
                      >
                        <ThumbsDown />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>

      <DialogFooter>
        <Button variant="ghost" onClick={() => props.onClose()}>
          Cancel
        </Button>
        <Button disabled={saving()} onClick={() => void save()}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

/** Likes and dislikes for every weapon trait, saved together */
export const PerkPreferences = (props: Props & { open: boolean }) => (
  <Dialog
    open={props.open}
    onOpenChange={(open) => {
      if (!open) {
        props.onClose();
      }
    }}
  >
    <Show when={props.open}>
      <PerkPreferencesContent loaded={props.loaded} onClose={props.onClose} />
    </Show>
  </Dialog>
);
