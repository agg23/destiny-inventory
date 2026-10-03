import { useNavigate } from "@solidjs/router";
import { BucketHashes } from "data/d2/generated-enums";
import { createMemo, For, Show } from "solid-js";

import { useApp } from "../App.tsx";
import { PageChrome } from "../chrome.tsx";
import {
  CLASSES,
  isArmorRailTerm,
  isCollected,
  isRailTerm,
  queryPicks,
  rankByName,
  STATUSES,
  termValue,
  withClass,
  withTerm,
  withTerms,
  type ClassName,
  type Entry,
  type Group,
} from "../collections.ts";
import { useUrl } from "../router.ts";
import { entryHref } from "../url.ts";
import { armorOrder } from "./armorSets.ts";
import { useCollectionData, useEntryPreview } from "./collectionData.ts";
import { collectionFilter, isSearch, queryName } from "./collectionSearch.ts";
import { ArmorBlock } from "./components/ArmorBlock.tsx";
import { CollectionTabs } from "./components/CollectionTabs.tsx";
import { CollectionTile } from "./components/CollectionTile.tsx";
import { EntryList } from "./components/EntryList.tsx";
import { CLASS_LABELS, Filters } from "./components/Filters.tsx";
import { Rail } from "./components/Rail.tsx";
import { SlotRows } from "./components/SlotRows.tsx";

const WEAPON_SLOTS = [
  BucketHashes.KineticWeapons,
  BucketHashes.EnergyWeapons,
  BucketHashes.PowerWeapons,
];

export const Collections = () => {
  const app = useApp();
  const url = useUrl();
  const navigate = useNavigate();
  const data = useCollectionData();
  const hover = useEntryPreview(data);

  const kind = () => url.get("kind");
  const grouping = () => url.get("by");
  const sections = () => {
    const built = data.index();

    if (!built) {
      return [];
    }

    return kind() === "weapon"
      ? built.sections[grouping()]
      : built.armorSections;
  };
  const entries = (): Entry[] => {
    const built = data.index();

    if (!built) {
      return [];
    }

    return kind() === "weapon" ? built.weapons : built.armor;
  };
  const railTerm = (key: string | undefined, value: string): boolean =>
    kind() === "weapon" ? isRailTerm(key, value) : isArmorRailTerm(key, value);
  const className = (): ClassName =>
    termValue(app.query(), "is", CLASSES) ??
    CLASSES[data.lastPlayedClass()] ??
    CLASSES[0];
  const classScoped = (query: string): string =>
    kind() === "armor" ? withClass(query, data.lastPlayedClass()) : query;
  const name = createMemo(() => queryName(app.query()));
  const searching = createMemo(() => isSearch(app.query()));

  const test = createMemo(() => {
    const built = data.index();

    return built
      ? collectionFilter(built, kind(), classScoped(app.query()), data)
      : () => false;
  });

  // Rail counts leave out the rail's own terms, like the dropdowns do
  const railTest = createMemo(() => {
    const built = data.index();
    const others = withTerms(classScoped(app.query()), railTerm, []);

    return built ? collectionFilter(built, kind(), others, data) : () => false;
  });

  const passes = (entry: Entry): boolean => test()(entry);

  const setTerm = (
    key: string,
    values: readonly string[],
    value: string | undefined,
  ) => app.onQuery(withTerm(app.query(), key, values, value));

  const groups = () => sections().flatMap((section) => section.groups);

  const picked = createMemo(() =>
    groups().filter((group) => queryPicks(app.query(), group)),
  );

  const shown = createMemo<Entry[]>(() =>
    rankByName(entries().filter(passes), name()),
  );

  const shownSet = createMemo(() => new Set(shown()));

  const blocks = createMemo<Group[]>(() => {
    if (picked().length > 0) {
      return picked();
    }

    return groups().filter((group) =>
      group.entries.some((entry) => shownSet().has(entry)),
    );
  });

  // An entry under several source groups shows in the first
  const owner = createMemo(() => {
    const owners = new Map<Entry, Group>();

    for (const group of blocks()) {
      for (const entry of group.entries) {
        if (shownSet().has(entry) && !owners.has(entry)) {
          owners.set(entry, group);
        }
      }
    }

    return owners;
  });

  const blockLabel = (group: Group): string => {
    const shared = blocks().some(
      (other) => other !== group && other.label === group.label,
    );
    const section = sections().find((one) => one.groups.includes(group));

    return shared && section ? `${section.label} ${group.label}` : group.label;
  };

  const tally = (passing: Entry[]): string => {
    const held = data.acquired.latest;

    if (!held || termValue(app.query(), "status", STATUSES) !== undefined) {
      return String(passing.length);
    }

    const count = passing.filter((entry) => isCollected(entry, held)).length;

    return `${count}/${passing.length}`;
  };

  const heading = (): string => {
    if (picked().length > 0) {
      return [...new Set(picked().map((group) => group.label))].join(" · ");
    }

    if (searching()) {
      return `Matching "${app.query().trim()}"`;
    }

    return "All";
  };

  const totalLabel = (): string => {
    const built = data.index();

    if (!built) {
      return "";
    }

    const counted: Entry[] =
      kind() === "weapon"
        ? built.weapons
        : built.armor.filter(
            (piece) => CLASSES[piece.classType] === className(),
          );
    const noun =
      kind() === "weapon"
        ? "weapons"
        : `${CLASS_LABELS[className()]} armor pieces`;
    const held = data.acquired.latest;

    if (!held) {
      return `${counted.length} ${noun}`;
    }

    const count = counted.filter((entry) => isCollected(entry, held)).length;

    return `${count} of ${counted.length} ${noun} collected`;
  };

  const open = (entry: Entry) =>
    navigate(
      entryHref(entry.newestItemHash, {
        kind: kind(),
        by: grouping(),
        layout: url.get("layout"),
        q: url.get("q"),
      }),
    );

  const tile = (entry: Entry) => (
    <CollectionTile
      entry={entry}
      ownership={data.ownership(entry)}
      copies={data.copiesOf(entry).length}
      catalyst={data.catalyst(entry)}
      onOpen={() => open(entry)}
      onEnter={(element) => hover.enter(entry, element)}
      onLeave={hover.leave}
    />
  );

  return (
    <>
      <PageChrome
        tabs={
          <CollectionTabs
            kind={kind()}
            grouping={grouping()}
            total={totalLabel()}
            onKind={(one) => url.push({ kind: one, q: "" })}
            onGrouping={(one) => url.push({ by: one })}
          />
        }
        tools={
          <Filters
            kind={kind()}
            query={app.query()}
            className={className()}
            layout={url.get("layout")}
            onTerm={setTerm}
            onLayout={(layout) => url.replace({ layout })}
          />
        }
      />

      <Show when={data.index.error}>
        {(e) => <p class="p-3 text-danger">{(e() as Error).message}</p>}
      </Show>

      <Show
        when={data.index()}
        fallback={
          <Show when={!data.index.error}>
            <div class="loading">
              <span class="spinner" aria-hidden="true" />
              <p class="text-muted">Loading collections</p>
            </div>
          </Show>
        }
      >
        <div class="collections p-3">
          <Rail
            sections={sections()}
            picked={picked()}
            allCount={tally(entries().filter(railTest()))}
            count={(group) => tally(group.entries.filter(railTest()))}
            onPick={(group) =>
              app.onQuery(withTerms(app.query(), railTerm, group?.terms ?? []))
            }
          />

          <section class="collections-grid">
            <Show
              when={shown().length > 0}
              fallback={
                <>
                  <h3 class="section-label mb-1.5">{heading()}</h3>
                  <p class="text-muted">Nothing matches that filter.</p>
                </>
              }
            >
              <For each={blocks()}>
                {(group, index) => {
                  const held = () =>
                    shown().filter((entry) => owner().get(entry) === group);

                  return (
                    <>
                      <h3
                        class="section-label mb-1.5"
                        classList={{ "mt-4": index() > 0 }}
                      >
                        {blockLabel(group)}
                        <span class="text-muted">{tally(held())}</span>
                      </h3>
                      <Show
                        when={url.get("layout") === "list"}
                        fallback={
                          <Show
                            when={kind() === "weapon"}
                            fallback={
                              <ArmorBlock
                                entries={held()}
                                count={tally}
                                tile={tile}
                              />
                            }
                          >
                            <SlotRows
                              slots={WEAPON_SLOTS}
                              entries={held()}
                              tile={tile}
                            />
                          </Show>
                        }
                      >
                        <EntryList
                          kind={kind()}
                          entries={
                            kind() === "armor" ? armorOrder(held()) : held()
                          }
                          data={data}
                          onOpen={open}
                          onEnter={hover.enter}
                          onLeave={hover.leave}
                        />
                      </Show>
                    </>
                  );
                }}
              </For>
            </Show>
          </section>
        </div>
      </Show>
    </>
  );
};
