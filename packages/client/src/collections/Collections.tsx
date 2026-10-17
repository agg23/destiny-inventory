import { useNavigate } from "@solidjs/router";
import { BucketHashes } from "data/d2/generated-enums";
import { createMemo, For, Show } from "solid-js";

import { Heading } from "../components/Heading.tsx";
import { cn } from "../components/lib/cn.ts";
import { Loading } from "../components/lib/Loading.tsx";
import { HEADING } from "../components/lib/text.ts";
import { useApp } from "../core/app/state.ts";
import { armorOrder } from "../core/collections/armorSets.ts";
import { rankByName } from "../core/collections/collections.ts";
import {
  collectionFilter,
  isSearch,
  queryName,
} from "../core/collections/collectionSearch.ts";
import { isCollected } from "../core/collections/ownership.ts";
import {
  CLASSES,
  isArmorRailTerm,
  isRailTerm,
  queryPicks,
  STATUSES,
  termValue,
  withClass,
  withTerm,
  withTerms,
  type ClassName,
} from "../core/collections/terms.ts";
import type { Entry, Group } from "../core/collections/types.ts";
import { useUrl } from "../core/router.ts";
import { entryHref } from "../core/url.ts";
import { ArmorBlock } from "./shared/ArmorBlock.tsx";
import { useCollectionData } from "./shared/collectionData.ts";
import { CollectionTabs } from "./shared/CollectionTabs.tsx";
import { CollectionTile } from "./shared/CollectionTile.tsx";
import { EntryList } from "./shared/EntryList.tsx";
import { CLASS_LABELS, Filters } from "./shared/Filters.tsx";
import { Rail } from "./shared/Rail.tsx";
import { SlotRows } from "./shared/SlotRows.tsx";

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

  // Rail counts leave out the rail's own terms
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
    />
  );

  return (
    <>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4">
        <CollectionTabs
          kind={kind()}
          grouping={grouping()}
          onKind={(one) => url.push({ kind: one, q: "" })}
          onGrouping={(one) => url.push({ by: one })}
        />
        <Filters
          kind={kind()}
          query={app.query()}
          className={className()}
          layout={url.get("layout")}
          onTerm={setTerm}
          onLayout={(layout) => url.replace({ layout })}
        />
        <span class="ml-auto text-muted-foreground tabular-nums">
          {totalLabel()}
        </span>
      </div>

      <Show when={data.index.error}>
        {(e) => (
          <p class="p-4 text-destructive">{(e() as Error).message}</p>
        )}
      </Show>

      <Show
        when={data.index()}
        fallback={
          <Show when={!data.index.error}>
            <Loading label="Loading collections" />
          </Show>
        }
      >
        <div class="grid grid-cols-[var(--store-column)_minmax(0,1fr)] items-start gap-4 p-4">
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
                  <h3 class={`${HEADING} mb-1.5`}>{heading()}</h3>
                  <p class="text-muted-foreground">
                    Nothing matches that filter.
                  </p>
                </>
              }
            >
              <For each={blocks()}>
                {(group, index) => {
                  const held = () =>
                    shown().filter((entry) => owner().get(entry) === group);

                  return (
                    <>
                      <Heading
                        as="h3"
                        class={cn("mb-1.5", index() > 0 && "mt-6")}
                        note={tally(held())}
                      >
                        {blockLabel(group)}
                      </Heading>
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
