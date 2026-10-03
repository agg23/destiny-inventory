import type { DimItem } from "app/inventory/item-types";
import { getItemKillTrackerInfo } from "app/utils/item-utils";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";

import { useApp } from "../App.tsx";
import {
  CLASSES,
  isArmorRailTerm,
  isRailTerm,
  queryPicks,
  sourceLabel,
  termValue,
  withClass,
  withTerms,
  type Entry,
} from "../collections.ts";
import { fakeItems } from "../fakeItems.ts";
import { ItemIcon } from "../ItemIcon.tsx";
import { ItemDetails, ItemHead } from "../ItemPanel.tsx";
import { useUrl } from "../router.ts";
import { Button } from "../ui/Button.tsx";
import { collectionsHref, vaultHref } from "../url.ts";
import { useCollectionData } from "./collectionData.ts";
import { collectionFilter } from "./collectionSearch.ts";

const KILL_LABELS: Record<string, string> = {
  pve: "PvE",
  pvp: "PvP",
  gambit: "Gambit",
};

const vaultQuery = (entry: Entry): string => {
  const query = `name:"${entry.name}" is:${entry.rarity.toLowerCase()}`;

  return entry.kind === "armor" ? withClass(query, entry.classType) : query;
};

const Copies = (props: { entry: Entry; copies: DimItem[] }) => {
  const navigate = useNavigate();

  return (
    <Show when={props.copies.length > 0}>
      <div class="weapon-block">
        <h4 class="section-label">Your copies</h4>
        <div class="weapon-copies">
          <For each={props.copies}>
            {(copy) => (
              <div class="weapon-copy">
                <ItemIcon
                  item={copy}
                  onSelect={() =>
                    navigate(vaultHref(vaultQuery(props.entry), copy.id))
                  }
                />
                <Show when={getItemKillTrackerInfo(copy)}>
                  {(tracker) => (
                    <span class="text-sm text-muted">
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
  const [allPerks, setAllPerks] = createSignal(true);

  const entry = createMemo(() =>
    data.index()?.byItemHash.get(Number(params.hash)),
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

  const versionCollected = (collectibleHash: number): boolean | undefined =>
    data.acquired.latest?.has(collectibleHash);

  const back = () => {
    const found = entry();
    const kind = found?.kind ?? url.get("kind");
    const by = url.get("by");
    const index = data.index();
    const railTerm = kind === "weapon" ? isRailTerm : isArmorRailTerm;
    const query = url.get("q");

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
    <div class="flex flex-col gap-3 px-3 pt-3">
      <Button size="sm" variant="ghost" class="self-start" onClick={back}>
        &larr; All collections
      </Button>

      <Show
        when={entry()}
        fallback={
          <Show
            when={data.index()}
            fallback={
              <div class="loading">
                <span class="spinner" aria-hidden="true" />
                <p class="text-muted">Loading collections</p>
              </div>
            }
          >
            <p class="text-muted">Unknown item</p>
          </Show>
        }
      >
        {(found) => (
          <div class="weapon-page">
            <Show when={newest()}>
              {(item) => (
                <div class="item-tooltip weapon-card">
                  <ItemHead item={item()} />
                  <ItemDetails
                    item={item()}
                    allPerks={allPerks()}
                    onToggleAllPerks={() => setAllPerks((was) => !was)}
                    hideRollWarning
                    catalyst={data.catalyst(found())}
                  />
                </div>
              )}
            </Show>

            <div class="weapon-facts">
              <div class="weapon-block">
                <h4 class="section-label">
                  {found().collectibleHashes.length > 1
                    ? "Versions"
                    : "Collection"}
                </h4>
                <ul class="weapon-versions">
                  <For each={found().collectibleHashes}>
                    {(collectibleHash) => {
                      const collectible = () =>
                        data.index()?.collectibles[collectibleHash];
                      const item = () =>
                        versions.latest?.get(collectible()?.itemHash ?? 0);

                      return (
                        <li class="weapon-version">
                          <Show
                            when={item()}
                            fallback={<span class="item-tile small" />}
                          >
                            {(version) => (
                              <ItemIcon item={version()} badges={false} />
                            )}
                          </Show>
                          <div>
                            <div
                              classList={{
                                "text-muted":
                                  versionCollected(collectibleHash) === false,
                              }}
                            >
                              {versionCollected(collectibleHash) === undefined
                                ? ""
                                : versionCollected(collectibleHash)
                                  ? "Collected"
                                  : "Not collected"}
                            </div>
                            <div class="text-sm text-muted">
                              {sourceLabel(collectible()?.sourceString ?? "")}
                            </div>
                          </div>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </div>

              <Copies entry={found()} copies={data.copiesOf(found())} />

              <div>
                <Show
                  when={data.copiesOf(found()).length > 0}
                  fallback={
                    <Button size="sm" disabled>
                      Show in vault
                    </Button>
                  }
                >
                  <A
                    class="button small"
                    href={vaultHref(vaultQuery(found()), undefined)}
                  >
                    Show in vault
                  </A>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};
