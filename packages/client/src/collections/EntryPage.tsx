import type { DimItem } from "app/inventory/item-types";
import { getItemKillTrackerInfo } from "app/utils/item-utils";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createMemo, createResource, For, Show } from "solid-js";

import { ItemDetails } from "../components/card/ItemDetails.tsx";
import { ItemHead, typeName } from "../components/card/ItemHead.tsx";
import { ItemTile } from "../components/ItemTile.tsx";
import { Loading } from "../components/lib/Loading.tsx";
import { HEADING } from "../components/lib/text.ts";
import { Button } from "../components/lib/zaidan/button.tsx";
import { NoteEditor } from "../components/NoteEditor.tsx";
import { BUNGIE } from "../core/api/bungie.ts";
import { useApp } from "../core/app/state.ts";
import {
  entryForHash,
  cosmeticEntry,
  ornamentTargets,
} from "../core/collections/collections.ts";
import { sourceLabel } from "../core/collections/ownership.ts";
import {
  CLASSES,
  isArmorRailTerm,
  isRailTerm,
  queryPicks,
  termValue,
  withClass,
  withTerms,
} from "../core/collections/terms.ts";
import type { Cosmetic, Entry } from "../core/collections/types.ts";
import { defs } from "../core/profile/defs.ts";
import { fakeItems } from "../core/profile/fakeItems.ts";
import { useUrl } from "../core/router.ts";
import {
  collectionsHref,
  entryHref,
  lightGgHref,
  vaultHref,
} from "../core/url.ts";
import { useCollectionData } from "./shared/collectionData.ts";
import { collectionFilter } from "./shared/collectionSearch.ts";

const BLOCK = "flex flex-col gap-2";

const KILL_LABELS: Record<string, string> = {
  pve: "PvE",
  pvp: "PvP",
  gambit: "Gambit",
};

const vaultQuery = (entry: Entry | Cosmetic): string => {
  const query = `name:"${entry.name}" is:${entry.rarity.toLowerCase()}`;

  return entry.kind === "armor" ? withClass(query, entry.classType) : query;
};

const Copies = (props: { entry: Entry | Cosmetic; copies: DimItem[] }) => {
  const navigate = useNavigate();

  return (
    <Show when={props.copies.length > 0}>
      <div class={BLOCK}>
        <h4 class={HEADING}>Your copies</h4>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(var(--tile),max-content))] gap-1.5">
          <For each={props.copies}>
            {(copy) => (
              <div class="flex flex-col gap-1">
                <ItemTile
                  item={copy}
                  onSelect={() =>
                    navigate(vaultHref(vaultQuery(props.entry), copy.id))
                  }
                />
                <Show when={getItemKillTrackerInfo(copy)}>
                  {(tracker) => (
                    <span class="text-xs text-muted-foreground">
                      {tracker().count.toLocaleString()}{" "}
                      {KILL_LABELS[tracker().type]}
                    </span>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};

export const EntryPage = () => {
  const app = useApp();
  const params = useParams();
  const navigate = useNavigate();
  const url = useUrl();
  const data = useCollectionData();

  const indexed = createMemo(() => {
    const index = data.index();

    return index ? entryForHash(index, Number(params.hash)) : undefined;
  });

  const [standIn] = createResource(
    () => {
      const loaded = app.loaded();
      const index = data.index();

      return loaded && index && !indexed()
        ? { loaded, index, hash: Number(params.hash) }
        : undefined;
    },
    async ({ loaded, index, hash }) => {
      const item = (await fakeItems(loaded, [hash])).get(hash);

      return item ? cosmeticEntry(index, item) : undefined;
    },
  );

  const entry = () => indexed() ?? standIn.latest;

  const [target] = createResource(
    () => {
      const loaded = app.loaded();

      return loaded ? { loaded, hash: Number(params.hash) } : undefined;
    },
    async ({ loaded, hash }) => {
      const [first] = (await ornamentTargets()).get(hash) ?? [];

      return first === undefined
        ? undefined
        : (await fakeItems(loaded, [first])).get(first);
    },
  );

  const [versions] = createResource(
    () => {
      const loaded = app.loaded();
      const found = entry();

      return loaded && found ? { loaded, found } : undefined;
    },
    ({ loaded, found }) => fakeItems(loaded, found.itemHashes),
  );

  const newest = () => {
    const found = entry();

    return found ? versions.latest?.get(found.newestItemHash) : undefined;
  };

  const setKey = () => {
    const found = entry();

    return found?.kind === "armor" ? found.setKey : undefined;
  };

  const screenshot = () => {
    const found = entry();
    const table = defs();

    // Defs only hold these items once fakeItems materializes them
    if (!found || !table || !versions.latest) {
      return undefined;
    }

    const path = [found.newestItemHash, ...found.itemHashes]
      .map((hash) => table.InventoryItem.getOptional(hash)?.screenshot)
      .find((one) => !!one);

    return path ? `${BUNGIE}${path}` : undefined;
  };

  const versionCollected = (collectibleHash: number): boolean | undefined =>
    data.acquired.latest?.has(collectibleHash);

  const back = () => {
    const viewed = entry();
    const found = viewed?.kind === "cosmetic" ? undefined : viewed;
    const kind = found?.kind ?? url.get("kind");
    const by = url.get("by");
    const index = data.index();
    const railTerm = kind === "weapon" ? isRailTerm : isArmorRailTerm;
    const asked = url.get("q");
    // Opened from the vault on another class's piece
    const query =
      found?.kind === "armor" &&
      found.classType !== data.lastPlayedClass() &&
      termValue(asked, "is", CLASSES) === undefined
        ? withClass(asked, found.classType)
        : asked;

    const groups = (
      (kind === "weapon" ? index?.sections[by] : index?.armorSections) ?? []
    ).flatMap((section) => section.groups);
    const holding = groups.filter(
      (group) => found && group.entries.includes(found),
    );
    const group = holding.find((one) => queryPicks(query, one)) ?? holding[0];
    const terms = group?.terms ?? [];
    const scoped = withTerms(query, railTerm, terms);
    const tested =
      found?.kind === "armor"
        ? withClass(scoped, data.lastPlayedClass())
        : scoped;
    const shown =
      !found || !index || collectionFilter(index, kind, tested, data)(found);
    const className = termValue(query, "is", CLASSES);

    navigate(
      collectionsHref("/collections", {
        kind,
        by,
        layout: url.get("layout"),
        q: shown
          ? scoped
          : [...terms, ...(className ? [`is:${className}`] : [])].join(" "),
      }),
    );
  };

  return (
    <div class="flex flex-col gap-3 p-4">
      <Button size="sm" variant="ghost" class="self-start" onClick={back}>
        &larr; All collections
      </Button>

      <Show
        when={entry()}
        fallback={
          <Show
            when={data.index() && !standIn.loading}
            fallback={
              <Loading label="Loading collections" />
            }
          >
            <p class="text-muted-foreground">Unknown item</p>
          </Show>
        }
      >
        {(found) => (
          <div class="weapon-page flex flex-wrap items-start gap-6">
            <Show when={newest()}>
              {(item) => (
                <div class="item-tooltip">
                  <ItemHead item={item()} />
                  <ItemDetails
                    item={item()}
                    allPerks
                    hideRollWarning
                    catalyst={data.catalyst(found())}
                  />
                </div>
              )}
            </Show>

            <div class="flex min-w-80 flex-1 flex-wrap items-start gap-6">
              <div class="flex min-w-80 flex-1 flex-col gap-6">
                <div class={BLOCK}>
                  <h4 class={HEADING}>
                    {found().collectibleHashes.length > 1
                      ? "Versions"
                      : "Collection"}
                  </h4>
                  <ul class="flex flex-col gap-1.5">
                    <For each={found().collectibleHashes}>
                      {(collectibleHash) => {
                        const collectible = () =>
                          data.index()?.collectibles[collectibleHash];
                        const item = () =>
                          versions.latest?.get(collectible()?.itemHash ?? 0);

                        return (
                          <li class="flex items-center gap-2">
                            <Show
                              when={item()}
                              fallback={<span class="item-tile small nested" />}
                            >
                              {(version) => (
                                <ItemTile item={version()} badges={false} />
                              )}
                            </Show>
                            <div>
                              <div
                                classList={{
                                  "text-muted-foreground":
                                    versionCollected(collectibleHash) === false,
                                }}
                              >
                                {versionCollected(collectibleHash) === undefined
                                  ? ""
                                  : versionCollected(collectibleHash)
                                  ? "Collected"
                                  : "Not collected"}
                              </div>
                              <div class="text-xs text-muted-foreground">
                                {sourceLabel(collectible()?.sourceString ?? "")}
                              </div>
                            </div>
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </div>

                <Show when={target.latest}>
                  {(fits) => (
                    <div class={BLOCK}>
                      <h4 class={HEADING}>Applies to</h4>
                      <A
                        class="flex items-center gap-2"
                        href={entryHref(fits().hash, {
                          kind: fits().bucket.inArmor ? "armor" : "weapon",
                        })}
                      >
                        <ItemTile item={fits()} badges={false} />
                        <div>
                          <div>{fits().name}</div>
                          <div class="text-xs text-muted-foreground">
                            {typeName(fits())}
                          </div>
                        </div>
                      </A>
                    </div>
                  )}
                </Show>

                <Copies entry={found()} copies={data.copiesOf(found())} />

                <Show
                  when={setKey()}
                  fallback={
                    <div class={BLOCK}>
                      <h4 class={HEADING}>Notes</h4>
                      <NoteEditor
                        target={{ kind: "item", targetId: found().key }}
                      />
                    </div>
                  }
                >
                  {(key) => (
                    <div class={BLOCK}>
                      <h4 class={HEADING}>Set notes</h4>
                      <NoteEditor target={{ kind: "set", targetId: key() }} />
                    </div>
                  )}
                </Show>

                <div class="flex gap-2">
                  <Show
                    when={data.copiesOf(found()).length > 0}
                    fallback={
                      <Button size="sm" variant="outline" disabled>
                        Show in vault
                      </Button>
                    }
                  >
                    <Button
                      as={A}
                      size="sm"
                      variant="outline"
                      href={vaultHref(vaultQuery(found()), undefined)}
                    >
                      Show in vault
                    </Button>
                  </Show>
                  <Button
                    as="a"
                    size="sm"
                    variant="outline"
                    href={lightGgHref(found().newestItemHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Show on light.gg
                  </Button>
                </div>
              </div>

              <Show when={screenshot()}>
                {(src) => (
                  <img
                    class="aspect-video min-w-80 max-w-2xl flex-1 rounded-md bg-muted object-cover"
                    src={src()}
                    alt=""
                  />
                )}
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};
