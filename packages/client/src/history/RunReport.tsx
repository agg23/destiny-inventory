import type { DimItem } from "app/inventory/item-types";
import type {
  DestinyPostGameCarnageReportData,
  DestinyPostGameCarnageReportEntry,
} from "bungie-api-ts/destiny2";
import { createResource, createSignal, For, onCleanup, Show } from "solid-js";

import type { ActivityTables } from "../activities.ts";
import { useApp } from "../App.tsx";
import { accessToken } from "../auth.ts";
import { fetchCarnageReport } from "../bungie.ts";
import { defs } from "../defs.ts";
import { fakeItems } from "../fakeItems.ts";
import { duration } from "../history.ts";
import { BUNGIE } from "../ItemPanel.tsx";
import type { Session } from "../load.ts";
import { cursorAnchor, dismiss, preview } from "../preview.ts";
import { REPORTS } from "../store.ts";

interface StoredReport {
  instanceId: string;
  report: DestinyPostGameCarnageReportData;
}

export interface ReportSource {
  instanceId: string;
  session: Session;
}

const fetchReport = async ({ instanceId, session }: ReportSource) => {
  const cached = await session.store.getOne<StoredReport>(REPORTS, instanceId);

  if (cached) {
    return cached.report;
  }

  const token = await accessToken();

  if (!token) {
    return undefined;
  }

  const fetched = await fetchCarnageReport(instanceId, token);

  // TODO: Store a slim projection, these run to six figures of JSON
  await session.store.putAll(REPORTS, [{ instanceId, report: fetched }]);

  return fetched;
};

export const createReport = (source: () => ReportSource | undefined) =>
  createResource(source, fetchReport);

// Defaults every run reports
const HOUSEKEEPING =
  /^(Empty Modifier|HUD |All Equipment|Equipment Unlocked|Activity Scoring|Normal Starting Ammo)/;

const stat = (entry: DestinyPostGameCarnageReportEntry, key: string): number =>
  entry.values[key]?.basic.value ?? 0;

const extended = (
  entry: DestinyPostGameCarnageReportEntry,
  key: string,
): number => entry.extended?.values[key]?.basic.value ?? 0;

const nameOf = (entry: DestinyPostGameCarnageReportEntry): string =>
  entry.player.destinyUserInfo.bungieGlobalDisplayName ||
  entry.player.destinyUserInfo.displayName;

// A report names a weapon by hash alone
const WeaponName = (props: { hash: number; item: DimItem | undefined }) => (
  <Show
    when={props.item}
    fallback={
      <span class="text-dim">
        {defs()?.InventoryItem.getOptional(props.hash)?.displayProperties
          .name ?? "Unknown weapon"}
      </span>
    }
  >
    {(item) => (
      <span class="inline-flex items-center gap-2">
        <img
          class={`item-tile small size-8 ${item().rarity.toLowerCase()}`}
          src={`${BUNGIE}${item().icon}`}
          loading="lazy"
          alt=""
        />
        {item().name}
      </span>
    )}
  </Show>
);

const Weapons = (props: { entry: DestinyPostGameCarnageReportEntry }) => {
  const app = useApp();

  const weapons = () =>
    [...(props.entry.extended?.weapons ?? [])].sort(
      (a, b) =>
        (b.values.uniqueWeaponKills?.basic.value ?? 0) -
        (a.values.uniqueWeaponKills?.basic.value ?? 0),
    );

  const [items] = createResource(
    () => {
      const loaded = app.loaded();
      const hashes = weapons().map((weapon) => weapon.referenceId);

      return loaded && hashes.length > 0 ? { loaded, hashes } : undefined;
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
  );

  const abilities = () => [
    { label: "Melee kills", value: extended(props.entry, "weaponKillsMelee") },
    {
      label: "Grenade kills",
      value: extended(props.entry, "weaponKillsGrenade"),
    },
    { label: "Super kills", value: extended(props.entry, "weaponKillsSuper") },
  ];

  return (
    <div class="grid grid-cols-[minmax(180px,1fr)_minmax(280px,2fr)] gap-6 max-md:grid-cols-1">
      <dl class="m-0 flex flex-col gap-1 text-md">
        <div class="flex justify-between gap-4 border-b border-line pb-1">
          <dt class="text-dim">Time played</dt>
          <dd class="m-0 tabular-nums">
            {duration(stat(props.entry, "timePlayedSeconds"))}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-dim">Joined at</dt>
          <dd class="m-0 tabular-nums">
            {duration(stat(props.entry, "startSeconds"))}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-dim">Class</dt>
          <dd class="m-0">{props.entry.player.characterClass || "-"}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-dim">Light</dt>
          <dd class="m-0 tabular-nums text-gold">
            {props.entry.player.lightLevel}
          </dd>
        </div>
      </dl>

      <table class="table">
        <thead>
          <tr>
            <th>Weapon</th>
            <th class="num">Kills</th>
            <th class="num">Precision</th>
            <th class="num">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          <For each={weapons()}>
            {(weapon) => {
              const item = () => items()?.get(weapon.referenceId);

              const track = (event: MouseEvent) => {
                const found = item();

                if (found) {
                  preview(found, cursorAnchor(event));
                }
              };

              const leave = () => {
                const found = item();

                if (found) {
                  dismiss(found);
                }
              };

              // Picking another player swaps these rows out from under the pointer
              onCleanup(leave);

              return (
                <tr
                  onMouseEnter={track}
                  onMouseMove={track}
                  onMouseLeave={leave}
                >
                  <td>
                    <WeaponName hash={weapon.referenceId} item={item()} />
                  </td>
                  <td class="num">
                    {weapon.values.uniqueWeaponKills?.basic.value ?? 0}
                  </td>
                  <td class="num">
                    {weapon.values.uniqueWeaponPrecisionKills?.basic.value ?? 0}
                  </td>
                  <td class="num">
                    {weapon.values.uniqueWeaponKillsPrecisionKills?.basic
                      .displayValue ?? "-"}
                  </td>
                </tr>
              );
            }}
          </For>
          <For each={abilities()}>
            {(one) => (
              <tr>
                <td class="text-dim">{one.label}</td>
                <td class="num">{one.value}</td>
                <td class="num text-dim">-</td>
                <td class="num text-dim">-</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};

export const Report = (props: {
  report: DestinyPostGameCarnageReportData;
  tables: ActivityTables | undefined;
  characterId: string;
}) => {
  const [shownPlayer, setShownPlayer] = createSignal<string | undefined>(
    undefined,
  );
  const [modifiers, setModifiers] = createSignal(false);

  const named = () => {
    const names = new Set<string>();

    // Pre-Witch Queen reports omit the field
    for (const hash of props.report.selectedSkullHashes ?? []) {
      const skull = props.tables?.skulls[hash];

      if (skull && !HOUSEKEEPING.test(skull.name)) {
        names.add(skull.name);
      }
    }

    return [...names].sort();
  };

  const fireteam = () =>
    [...props.report.entries].sort(
      (a, b) => stat(b, "opponentsDefeated") - stat(a, "opponentsDefeated"),
    );

  const picked = () =>
    fireteam().find(
      (one) => one.characterId === (shownPlayer() ?? props.characterId),
    ) ?? fireteam()[0];

  return (
    <div class="flex flex-col gap-3">
      <Show when={named().length > 0}>
        <div class="flex flex-col gap-2">
          <button
            type="button"
            class="button small ghost self-start"
            aria-pressed={modifiers()}
            onClick={() => setModifiers(!modifiers())}
          >
            {modifiers() ? "Hide modifiers" : `Modifiers (${named().length})`}
          </button>
          <Show when={modifiers()}>
            <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-md text-text">
              <For each={named()}>{(name) => <li>{name}</li>}</For>
            </ul>
          </Show>
        </div>
      </Show>

      <table class="table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="num">Kills + assists</th>
            <th class="num">Kills</th>
            <th class="num">Deaths</th>
            <th class="num">K/D</th>
            <th class="num">Score</th>
          </tr>
        </thead>
        <tbody>
          <For each={fireteam()}>
            {(entry) => (
              <tr
                class="cursor-pointer"
                classList={{
                  highlight: picked()?.characterId === entry.characterId,
                }}
                onClick={() => setShownPlayer(entry.characterId)}
              >
                <td>
                  <span class="flex items-center gap-2">
                    <Show when={entry.player.destinyUserInfo.iconPath}>
                      {(icon) => (
                        <img
                          class="size-6 shrink-0"
                          src={`${BUNGIE}${icon()}`}
                          alt=""
                        />
                      )}
                    </Show>
                    <span
                      classList={{
                        "text-gold": entry.characterId === props.characterId,
                      }}
                    >
                      {nameOf(entry)}
                    </span>
                  </span>
                </td>
                <td class="num">{stat(entry, "opponentsDefeated")}</td>
                <td class="num">{stat(entry, "kills")}</td>
                <td class="num">{stat(entry, "deaths")}</td>
                <td class="num">
                  {stat(entry, "killsDeathsRatio").toFixed(2)}
                </td>
                <td class="num">{stat(entry, "score").toLocaleString()}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <Show when={picked()}>{(entry) => <Weapons entry={entry()} />}</Show>
    </div>
  );
};
