import type { DimItem } from "app/inventory/item-types";
import type {
  DestinyPostGameCarnageReportData,
  DestinyPostGameCarnageReportEntry,
} from "bungie-api-ts/destiny2";
import { createResource, createSignal, For, onCleanup, Show } from "solid-js";

import { ItemIcon } from "../../components/ItemIcon.tsx";
import { TABLE_FRAME, TABLE_HEADER } from "../../components/lib/text.ts";
import { Button } from "../../components/lib/zaidan/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { duration } from "../../core/activities/history.ts";
import type { ActivityTables } from "../../core/activities/types.ts";
import { accessToken } from "../../core/api/auth.ts";
import { BUNGIE, fetchCarnageReport } from "../../core/api/bungie.ts";
import { useApp } from "../../core/app/state.ts";
import { dismiss, preview } from "../../core/items/preview.ts";
import { defs } from "../../core/profile/defs.ts";
import { fakeItems } from "../../core/profile/fakeItems.ts";
import type { Session } from "../../core/profile/loadTypes.ts";
import { REPORTS } from "../../core/profile/store.ts";

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
      <span class="text-muted-foreground">
        {defs()?.InventoryItem.getOptional(props.hash)?.displayProperties
          .name ?? "Unknown weapon"}
      </span>
    }
  >
    {(item) => (
      <span class="inline-flex items-center gap-2">
        <ItemIcon item={item()} class="size-8" badges={false} />
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
      <dl class="flex flex-col gap-1">
        <div class="flex justify-between gap-4 border-b pb-1">
          <dt class="text-muted-foreground">Time played</dt>
          <dd class="m-0 tabular-nums">
            {duration(stat(props.entry, "timePlayedSeconds"))}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Joined at</dt>
          <dd class="m-0 tabular-nums">
            {duration(stat(props.entry, "startSeconds"))}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Class</dt>
          <dd class="m-0">{props.entry.player.characterClass || "-"}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Light</dt>
          <dd class="tabular-nums text-cream">
            {props.entry.player.lightLevel}
          </dd>
        </div>
      </dl>

      <div class={`${TABLE_FRAME} bg-background`}>
        <Table>
          <TableHeader class={TABLE_HEADER}>
            <TableRow>
              <TableHead>Weapon</TableHead>
              <TableHead class="text-right tabular-nums">Kills</TableHead>
              <TableHead class="text-right tabular-nums">Precision</TableHead>
              <TableHead class="text-right tabular-nums">Accuracy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={weapons()}>
              {(weapon) => {
                const item = () => items()?.get(weapon.referenceId);

                const track = (
                  event: MouseEvent & { currentTarget: HTMLTableRowElement },
                ) => {
                  const found = item();

                  if (found) {
                    preview(
                      found,
                      event.currentTarget,
                      event.clientX,
                      undefined,
                      true,
                    );
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
                  <TableRow
                    onMouseEnter={track}
                    onMouseMove={track}
                    onMouseLeave={leave}
                  >
                    <TableCell>
                      <WeaponName hash={weapon.referenceId} item={item()} />
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {weapon.values.uniqueWeaponKills?.basic.value ?? 0}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {weapon.values.uniqueWeaponPrecisionKills?.basic.value ??
                        0}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {weapon.values.uniqueWeaponKillsPrecisionKills?.basic
                        .displayValue ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              }}
            </For>
            <For each={abilities()}>
              {(one) => (
                <TableRow>
                  <TableCell class="text-muted-foreground">
                    {one.label}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {one.value}
                  </TableCell>
                  <TableCell class="text-right text-muted-foreground tabular-nums">
                    -
                  </TableCell>
                  <TableCell class="text-right text-muted-foreground tabular-nums">
                    -
                  </TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </div>
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
          <Button
            size="sm"
            variant="ghost"
            class="self-start"
            aria-pressed={modifiers()}
            onClick={() => setModifiers(!modifiers())}
          >
            {modifiers() ? "Hide modifiers" : `Modifiers (${named().length})`}
          </Button>
          <Show when={modifiers()}>
            <ul class="flex flex-wrap gap-x-4 gap-y-1">
              <For each={named()}>{(name) => <li>{name}</li>}</For>
            </ul>
          </Show>
        </div>
      </Show>

      <div class={`${TABLE_FRAME} bg-background`}>
        <Table>
          <TableHeader class={TABLE_HEADER}>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead class="text-right tabular-nums">
                Kills + assists
              </TableHead>
              <TableHead class="text-right tabular-nums">Kills</TableHead>
              <TableHead class="text-right tabular-nums">Deaths</TableHead>
              <TableHead class="text-right tabular-nums">K/D</TableHead>
              <TableHead class="text-right tabular-nums">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={fireteam()}>
              {(entry) => (
                <TableRow
                  class="cursor-pointer"
                  data-state={
                    picked()?.characterId === entry.characterId
                      ? "selected"
                      : undefined
                  }
                  onClick={() => setShownPlayer(entry.characterId)}
                >
                  <TableCell>
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
                          "text-cream": entry.characterId === props.characterId,
                        }}
                      >
                        {nameOf(entry)}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {stat(entry, "opponentsDefeated")}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {stat(entry, "kills")}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {stat(entry, "deaths")}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {stat(entry, "killsDeathsRatio").toFixed(2)}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {stat(entry, "score").toLocaleString()}
                  </TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </div>

      <Show when={picked()}>{(entry) => <Weapons entry={entry()} />}</Show>
    </div>
  );
};
