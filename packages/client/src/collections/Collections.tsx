import { BucketHashes } from "data/d2/generated-enums";
import { useNavigate } from "@solidjs/router";
import { createMemo, For, Show } from "solid-js";

import { useApp } from "../App.tsx";
import { BUNGIE } from "../bungie.ts";
import { PageChrome } from "../chrome.tsx";
import {
  CATALYSTS,
  isCollected,
  rankByName,
  RARITIES,
  sourceLabel,
  STATUSES,
  termValue,
  isRailTerm,
  queryPicks,
  withTerm,
  withTerms,
  type Group,
  type Weapon,
} from "../collections.ts";
import { defs } from "../defs.ts";
import { useUrl } from "../router.ts";
import { TabButton } from "../ui/TabButton.tsx";
import { LAYOUTS, weaponHref, type Grouping, type Layout } from "../url.ts";
import { CollectionTile, damageIcon, weaponTier } from "./CollectionTile.tsx";
import {
  useCollectionData,
  useWeaponPreview,
  type CollectionData,
} from "./collectionData.ts";
import { isSearch, queryName, weaponFilter } from "./weaponSearch.ts";

const SLOTS = [
  BucketHashes.KineticWeapons,
  BucketHashes.EnergyWeapons,
  BucketHashes.PowerWeapons,
];

const GROUPING_LABELS: Record<Grouping, string> = {
  type: "By type",
  source: "By source",
};

const LAYOUT_LABELS: Record<Layout, string> = {
  grid: "Grid",
  list: "List",
};

const RARITY_LABELS: Record<(typeof RARITIES)[number], string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
  exotic: "Exotic",
};

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  owned: "Owned",
  unlocked: "Unlocked",
  neverseen: "Never seen",
};

const CATALYST_LABELS: Record<(typeof CATALYSTS)[number], string> = {
  missing: "Missing",
  obtained: "Obtained",
  complete: "Complete",
};

const ALL = "";

const Choice = <T extends string>(props: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  all?: boolean;
  onChoose: (value: T | undefined) => void;
}) => (
  <label class="flex items-center gap-2 text-sm text-dim">
    {props.label}
    <select
      class="select small"
      value={props.value ?? ALL}
      onChange={(event) => {
        const value = event.currentTarget.value;

        props.onChoose(value === ALL ? undefined : (value as T));
      }}
    >
      <Show when={props.all ?? true}>
        <option value={ALL}>All</option>
      </Show>
      <For each={props.options}>
        {(option) => <option value={option}>{props.labels[option]}</option>}
      </For>
    </select>
  </label>
);

const ownershipText = (data: CollectionData, weapon: Weapon): string => {
  const copies = data.copiesOf(weapon).length;

  switch (data.ownership(weapon)) {
    case "owned":
      return copies > 1 ? `Owned ×${copies}` : "Owned";
    case "unlocked":
      return "Unlocked";
    case "neverseen":
      return "Never seen";
    default:
      return "";
  }
};

const catalystText = (data: CollectionData, weapon: Weapon): string => {
  const catalyst = data.catalyst(weapon);

  if (!catalyst) {
    return "";
  }

  if (catalyst.complete) {
    return "Complete";
  }

  return catalyst.unlocked ? "Obtained" : "Missing";
};

const WeaponList = (props: {
  weapons: Weapon[];
  data: CollectionData;
  onOpen: (weapon: Weapon) => void;
  onEnter: (weapon: Weapon, element: HTMLElement) => void;
  onLeave: () => void;
}) => (
  <table class="table collections-table">
    <thead>
      <tr>
        <th />
        <th>Name</th>
        <th>Type</th>
        <th>Source</th>
        <th>Status</th>
        <th>Catalyst</th>
        <th>Aegis</th>
      </tr>
    </thead>
    <tbody>
      <For each={props.weapons}>
        {(weapon) => (
          <tr
            classList={{
              neverseen: props.data.ownership(weapon) === "neverseen",
            }}
            onClick={() => props.onOpen(weapon)}
          >
            <td
              class="collections-table-icon"
              onMouseEnter={(e) => props.onEnter(weapon, e.currentTarget)}
              onMouseLeave={() => props.onLeave()}
            >
              <img src={`${BUNGIE}${weapon.icon}`} loading="lazy" alt="" />
            </td>
            <td class={`text-${weapon.rarity.toLowerCase()}`}>{weapon.name}</td>
            <td>
              <span class="collections-type">
                <Show when={damageIcon(weapon)}>
                  {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
                </Show>
                {weapon.typeName}
              </span>
            </td>
            <td class="text-muted">{sourceLabel(weapon.sources[0] ?? "")}</td>
            <td
              classList={{
                "text-gold": props.data.ownership(weapon) === "owned",
                "text-muted": props.data.ownership(weapon) === "neverseen",
              }}
            >
              {ownershipText(props.data, weapon)}
            </td>
            <td>{catalystText(props.data, weapon)}</td>
            <td>
              <Show when={weaponTier(weapon)}>
                {(tier) => (
                  <span class={`tier-chip tier-${tier().toLowerCase()}`}>
                    {tier()}
                  </span>
                )}
              </Show>
            </td>
          </tr>
        )}
      </For>
    </tbody>
  </table>
);

export const Collections = () => {
  const app = useApp();
  const url = useUrl();
  const navigate = useNavigate();
  const data = useCollectionData();
  const hover = useWeaponPreview(data);

  const grouping = () => url.get("by");
  const sections = () => data.index()?.sections[grouping()] ?? [];
  const name = createMemo(() => queryName(app.query()));
  const searching = createMemo(() => isSearch(app.query()));

  const test = createMemo(() => {
    const built = data.index();

    return built ? weaponFilter(built, app.query(), data) : () => false;
  });

  // Rail counts leave out the rail's own terms, like the dropdowns do
  const railTest = createMemo(() => {
    const built = data.index();
    const others = withTerms(app.query(), isRailTerm, []);

    return built ? weaponFilter(built, others, data) : () => false;
  });

  const passes = (weapon: Weapon): boolean => test()(weapon);

  const setTerm = (
    key: string,
    values: readonly string[],
    value: string | undefined,
  ) => app.onQuery(withTerm(app.query(), key, values, value));

  const groups = () => sections().flatMap((section) => section.groups);

  const picked = createMemo(() =>
    groups().filter((group) => queryPicks(app.query(), group)),
  );

  const shown = createMemo<Weapon[]>(() => {
    const built = data.index();

    if (!built) {
      return [];
    }

    return rankByName(built.weapons.filter(passes), name());
  });

  const shownSet = createMemo(() => new Set(shown()));

  const blocks = createMemo<Group[]>(() => {
    if (picked().length > 0) {
      return picked();
    }

    return groups().filter((group) =>
      group.weapons.some((weapon) => shownSet().has(weapon)),
    );
  });

  // A weapon under several source groups shows in the first
  const owner = createMemo(() => {
    const owners = new Map<Weapon, Group>();

    for (const group of blocks()) {
      for (const weapon of group.weapons) {
        if (shownSet().has(weapon) && !owners.has(weapon)) {
          owners.set(weapon, group);
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

  const tally = (passing: Weapon[]): string => {
    const held = data.acquired.latest;

    if (!held || termValue(app.query(), "status", STATUSES) !== undefined) {
      return String(passing.length);
    }

    const count = passing.filter((weapon) => isCollected(weapon, held)).length;

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

  const open = (weapon: Weapon) =>
    navigate(
      weaponHref(weapon.newestItemHash, {
        by: grouping(),
        layout: url.get("layout"),
        q: url.get("q"),
      }),
    );

  return (
    <>
      <PageChrome
        tabs={
          <div class="header-tabs-line">
            <nav class="nav-subtabs">
              <For each={["type", "source"] as Grouping[]}>
                {(one) => (
                  <TabButton
                    active={grouping() === one}
                    onClick={() => url.push({ by: one })}
                  >
                    {GROUPING_LABELS[one]}
                  </TabButton>
                )}
              </For>
            </nav>
            <Show when={data.index()}>
              {(built) => (
                <span class="text-sm text-dim tabular-nums">
                  <Show
                    when={data.acquired.latest}
                    fallback={`${built().weapons.length} weapons`}
                  >
                    {(held) => {
                      const weapons = built().weapons;
                      const count = weapons.filter((weapon) =>
                        isCollected(weapon, held()),
                      ).length;

                      return `${count} of ${weapons.length} weapons collected`;
                    }}
                  </Show>
                </span>
              )}
            </Show>
          </div>
        }
        tools={
          <>
            <Choice
              label="Rarity"
              options={RARITIES}
              labels={RARITY_LABELS}
              value={termValue(app.query(), "is", RARITIES)}
              onChoose={(value) => setTerm("is", RARITIES, value)}
            />
            <Choice
              label="Status"
              options={STATUSES}
              labels={STATUS_LABELS}
              value={termValue(app.query(), "status", STATUSES)}
              onChoose={(value) => setTerm("status", STATUSES, value)}
            />
            <Choice
              label="Catalyst"
              options={CATALYSTS}
              labels={CATALYST_LABELS}
              value={termValue(app.query(), "catalyst", CATALYSTS)}
              onChoose={(value) => setTerm("catalyst", CATALYSTS, value)}
            />
            <Choice
              label="View"
              options={LAYOUTS}
              labels={LAYOUT_LABELS}
              value={url.get("layout")}
              all={false}
              onChoose={(layout) => url.replace({ layout })}
            />
          </>
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
          <nav class="collections-rail">
            <ul class="menu-list collections-section">
              <li>
                <button
                  type="button"
                  class="menu-item"
                  classList={{ active: picked().length === 0 }}
                  onClick={() =>
                    app.onQuery(withTerms(app.query(), isRailTerm, []))
                  }
                >
                  All
                  <span class="menu-item-note">
                    {tally(data.index()?.weapons.filter(railTest()) ?? [])}
                  </span>
                </button>
              </li>
            </ul>
            <For each={sections()}>
              {(section) => (
                <div class="collections-section">
                  <h4 class="section-label mb-2">{section.label}</h4>
                  <ul class="menu-list">
                    <For each={section.groups}>
                      {(group) => (
                        <li>
                          <button
                            type="button"
                            class="menu-item"
                            classList={{ active: picked().includes(group) }}
                            onClick={() =>
                              app.onQuery(
                                withTerms(app.query(), isRailTerm, group.terms),
                              )
                            }
                          >
                            {group.label}
                            <span class="menu-item-note">
                              {tally(group.weapons.filter(railTest()))}
                            </span>
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              )}
            </For>
          </nav>

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
                  const weapons = () =>
                    shown().filter((weapon) => owner().get(weapon) === group);

                  return (
                    <>
                      <h3
                        class="section-label mb-1.5"
                        classList={{ "mt-4": index() > 0 }}
                      >
                        {blockLabel(group)}
                        <span class="text-muted">{tally(weapons())}</span>
                      </h3>
                      <Show
                        when={url.get("layout") === "list"}
                        fallback={
                          <For
                            each={SLOTS.filter((slot) =>
                              weapons().some(
                                (weapon) => weapon.bucketHash === slot,
                              ),
                            )}
                          >
                            {(slot) => (
                              <div class="collections-slot">
                                <h4 class="bucket-label">
                                  {defs()?.InventoryBucket.getOptional(slot)
                                    ?.displayProperties.name ?? ""}
                                </h4>
                                <div class="item-grid">
                                  <For
                                    each={weapons().filter(
                                      (weapon) => weapon.bucketHash === slot,
                                    )}
                                  >
                                    {(weapon) => (
                                      <CollectionTile
                                        weapon={weapon}
                                        ownership={data.ownership(weapon)}
                                        copies={data.copiesOf(weapon).length}
                                        catalyst={data.catalyst(weapon)}
                                        onOpen={() => open(weapon)}
                                        onEnter={(element) =>
                                          hover.enter(weapon, element)
                                        }
                                        onLeave={hover.leave}
                                      />
                                    )}
                                  </For>
                                </div>
                              </div>
                            )}
                          </For>
                        }
                      >
                        <WeaponList
                          weapons={weapons()}
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
