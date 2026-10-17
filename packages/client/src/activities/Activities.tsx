import type { DimItem } from "app/inventory/item-types";
import { A, useNavigate } from "@solidjs/router";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import {
  DIFFICULTIES,
  difficultyOf,
  type GearTier,
  type SlimTier,
} from "@dvm/defs-core";

import { useApp } from "../App.tsx";
import { holdAnchor, releaseAnchor } from "../components/lib/anchor.ts";
import { AnchoredPanel } from "../components/lib/AnchoredPanel.tsx";
import { MapGlyph } from "../components/lib/MapGlyph.tsx";
import { PickOne } from "../components/lib/PickOne.tsx";
import { Objective } from "../components/lib/Progress.tsx";
import {
  LABEL,
  SPENT,
  TABLE_FRAME,
  TABLE_HEADER,
} from "../components/lib/text.ts";
import { Badge } from "../components/lib/zaidan/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/lib/zaidan/table.tsx";
import {
  barred,
  BONUS_DROP_ITEM,
  categorize,
  matching,
  readable,
  tileArt,
  type Available,
  type Challenge,
  type GearDrop,
  type Loot,
  type Matchmaking,
  type Realm,
} from "../core/activities/activities.ts";
import { activityTables } from "../core/activities/activityTables.ts";
import { guideNamed } from "../core/activities/guides.ts";
import {
  ago,
  bestTiming,
  duration,
  type ActivityTiming,
  type HistoryRun,
} from "../core/activities/history.ts";
import { BUNGIE } from "../core/api/bungie.ts";
import { useClock } from "../core/clock.ts";
import { dismiss, HOVER_DELAY, preview } from "../core/items/preview.ts";
import { defs } from "../core/profile/defs.ts";
import { builtFakes, fakeItems } from "../core/profile/fakeItems.ts";
import { useUrl } from "../core/router.ts";
import { guideHref, runHref } from "../core/url.ts";
import { activityLookup } from "../history/shared/activityLookup.ts";
import { clock } from "../history/shared/runFormat.ts";
import { baseline } from "./shared/baseline.ts";
import {
  countdown,
  HOUR,
  schedule,
  type Rotation,
} from "./shared/distortion.ts";

type Values = Record<number, number>;

interface Section {
  name: string;
  entries: Available[];
}

const FEATURED = "Featured";
const REMAINING = "Bonus engrams left this week";

const PANEL =
  "z-hover-card-content pointer-events-none z-6 flex max-h-[calc(100dvh-16px)] w-88 flex-col gap-3 overflow-hidden p-4";

const MATCHMAKING: Record<Matchmaking, string | undefined> = {
  required: "Matchmade",
  optional: "MM optional",
  none: undefined,
};

// Nothing in the payload says this
const BASE_DROPS = 1;

const TOP_GEAR_TIER = 5;

// Now plus the next three
const STRIP_ZONES = 4;

const ANY = "Any";
const RANGE = "Range";

const NORMAL_RANK = DIFFICULTIES.indexOf("Normal");
const TOP_RANK = DIFFICULTIES.length - 1;

const RUNG_ORDER = new Map(DIFFICULTIES.map((name, at) => [name, at]));

const power = (entry: Available): string | undefined => {
  if (entry.power === undefined || entry.topPower === undefined) {
    return undefined;
  }

  return entry.power === entry.topPower
    ? String(entry.power)
    : `${entry.power}–${entry.topPower}`;
};

const where = (entry: Available): string =>
  [entry.typeName, entry.location].filter(Boolean).join(" · ");

const subline = (entry: Available): string =>
  [entry.typeName, entry.location, MATCHMAKING[entry.matchmaking]]
    .filter(Boolean)
    .join(" · ");

const byRung = (a: string, b: string): number =>
  (RUNG_ORDER.get(a) ?? TOP_RANK) - (RUNG_ORDER.get(b) ?? TOP_RANK);

const rungs = (entry: Available): string[] => {
  if (entry.difficulties.length > 0) {
    return entry.difficulties.map((tier) => tier.name);
  }

  const named = new Set(
    entry.variants.flatMap((one) => (one.difficulty ? [one.difficulty] : [])),
  );

  return [...named].sort(byRung);
};

const wholeLadder = (names: string[]): boolean => {
  const first = DIFFICULTIES.indexOf(names[0] ?? "");
  const last = DIFFICULTIES.indexOf(names[names.length - 1] ?? "");

  return first >= 0 && first <= NORMAL_RANK && last === TOP_RANK;
};

interface Rung {
  name: string;
  tier: SlimTier | undefined;
}

const ladder = (entry: Available): Rung[] =>
  entry.difficulties.length > 0
    ? entry.difficulties.map((tier) => ({ name: tier.name, tier }))
    : rungs(entry).map((name) => ({ name, tier: undefined }));

const rung = (entry: Available): string | undefined => {
  const names = rungs(entry);

  if (names.length === 0) {
    return difficultyOf(entry.name);
  }

  if (names.length === 1) {
    return names[0];
  }

  return wholeLadder(names) ? ANY : RANGE;
};

const gearLabel = (tier: GearTier): string =>
  tier.low === tier.high ? `T${tier.high}` : `T${tier.low}-${tier.high}`;

const topTier = (gear: GearDrop): boolean => gear.base.low >= TOP_GEAR_TIER;

const gearText = (gear: GearDrop): string => {
  const base = gearLabel(gear.base);
  const top = gearLabel(gear.top);

  return base === top ? base : `${base} / ${top}`;
};

interface Door {
  name: string | undefined;
  tier: GearTier;
}

const doors = (entry: Available): Door[] => {
  const held = new Map<string, Door>();

  for (const one of entry.variants) {
    if (!one.gearTier) {
      continue;
    }

    held.set(`${one.difficulty ?? ""}|${gearLabel(one.gearTier)}`, {
      name: one.difficulty,
      tier: one.gearTier,
    });
  }

  return [...held.values()].sort((a, b) => byRung(a.name ?? "", b.name ?? ""));
};

const rewardsOf = (entry: Available): { loot: Loot; spent: boolean }[] => [
  ...(entry.focus ? [{ loot: entry.focus, spent: false }] : []),
  ...entry.bonus.map((loot) => ({ loot, spent: false })),
  ...(entry.spentFocus ? [{ loot: entry.spentFocus, spent: true }] : []),
  ...entry.spentBonus.map((loot) => ({ loot, spent: true })),
];

interface Hovered {
  entry: Available;
  cursorX: number | undefined;
}

const createActivities = () => {
  const app = useApp();
  const url = useUrl();
  const [tables] = createResource(activityTables, {
    initialValue: activityTables.settled(),
  });
  const [captured] = createResource(baseline, {
    initialValue: baseline.settled(),
  });
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);

  const character = () => app.active()?.id;

  const now = useClock();
  const hour = createMemo(() => Math.floor(now() / HOUR));
  const turns = createMemo(() => schedule(hour() * HOUR));

  let hoverTimer: number | undefined = undefined;

  const hide = () => {
    releaseAnchor();
    setHovered(undefined);
  };

  const onHover = (
    entry: Available,
    element: HTMLElement,
    cursorX: number | undefined = undefined,
  ) => {
    const open = () => {
      holdAnchor(element, hide);
      setHovered({ entry, cursorX });
    };

    if (hovered()?.entry.key === entry.key) {
      open();

      return;
    }

    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(open, HOVER_DELAY);
  };

  const onLeave = (entry: Available) => {
    window.clearTimeout(hoverTimer);

    if (hovered()?.entry.key === entry.key) {
      hide();
    }
  };

  const all = (): Realm[] => {
    const loaded = tables();
    const held = character();
    const entries =
      held === undefined
        ? undefined
        : app.loaded()?.activities[held]?.availableActivities;

    if (!loaded || !entries) {
      return [];
    }

    return categorize([...entries], loaded, (hash) => captured()?.rows[hash]);
  };

  const realms = createMemo(() => matching(all(), app.query()));

  const realm = createMemo((): Realm | undefined => {
    const found = realms();

    return found.find((one) => one.name === url.get("realm")) ?? found[0];
  });

  const values = (): Values =>
    (character() === undefined
      ? undefined
      : app.loaded()?.variables[character() ?? ""]) ?? {};

  const glyph = () => tables()?.rewards[BONUS_DROP_ITEM]?.icon;

  const lookup = createMemo(() => activityLookup(tables()));

  const hrefFor = (run: HistoryRun): string =>
    runHref(lookup().labelOf(run), lookup().rungOf(run), run.instanceId);

  const timingFor = (entry: Available): ActivityTiming | undefined =>
    bestTiming(app.timings(), [
      entry.hash,
      ...entry.variants.map((one) => one.hash),
    ]);

  const rewardHashes = createMemo(() => [
    ...new Set(
      realms()
        .flatMap((one) => one.categories)
        .flatMap((one) => one.entries)
        .flatMap((entry) => rewardsOf(entry).map((one) => one.loot.hash)),
    ),
  ]);

  const [items] = createResource(
    () => {
      const loaded = app.loaded();
      const hashes = rewardHashes();

      return loaded && hashes.length > 0 ? { loaded, hashes } : undefined;
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
    { initialValue: builtFakes(rewardHashes()) },
  );

  return {
    app,
    tables,
    all,
    realms,
    realm,
    values,
    glyph,
    hrefFor,
    timingFor,
    itemFor: (loot: Loot): DimItem | undefined => items()?.get(loot.hash),
    hovered,
    onHover,
    onLeave,
    now,
    turns,
    pickRealm: (name: string) => {
      // The row unmounts without a mouseleave
      hide();
      url.push({ realm: name });
    },
  };
};

type Data = ReturnType<typeof createActivities>;

const GLYPH = "shrink-0 object-contain";

const Icon = (props: { icon: string | undefined; class: string }) => (
  <Show
    when={props.icon}
    fallback={<span class={`${GLYPH} bg-muted ${props.class}`} />}
  >
    {(icon) => (
      <img
        class={`${GLYPH} ${props.class}`}
        src={`${BUNGIE}${icon()}`}
        alt=""
      />
    )}
  </Show>
);

const ChallengeMark = () => (
  <svg class="size-(--icon-xs)" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M8 1.5 14.5 8 8 14.5 1.5 8Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <circle cx="8" cy="8" r="2.4" fill="currentColor" />
  </svg>
);

const BonusCount = (props: { count: number; glyph: string | undefined }) => (
  <Show when={props.count}>
    {(count) => (
      <span
        class="inline-flex items-center gap-1 tabular-nums text-cream"
        title={REMAINING}
      >
        <Icon icon={props.glyph} class="size-(--icon-xs)" />
        {count()}
      </span>
    )}
  </Show>
);

interface NamedProps {
  loot: Loot;
  item: DimItem | undefined;
  spent: boolean;
  onHide: () => void;
}

const Named = (props: NamedProps) => {
  // Or the row under it re-anchors the activity panel onto this chip
  const track = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    event.stopPropagation();

    if (!props.item) {
      return;
    }

    props.onHide();
    preview(props.item, event.currentTarget, event.clientX);
  };

  const leave = () => {
    if (props.item) {
      dismiss(props.item);
    }
  };

  onCleanup(leave);

  return (
    <span
      class="flex max-w-44 min-w-0 items-center gap-1.5"
      classList={{ [SPENT]: props.spent }}
      title={props.loot.name}
      onMouseEnter={track}
      onMouseMove={track}
      onMouseLeave={leave}
    >
      <Icon
        icon={props.loot.icon}
        class={props.spent ? "size-(--icon-sm) opacity-60 grayscale" : "size-(--icon-sm)"}
      />
      <span class="truncate">{props.loot.name}</span>
      <Show when={props.loot.quantity > 1}>
        <span class="opacity-60">×{props.loot.quantity}</span>
      </Show>
    </span>
  );
};

const Dash = () => <span class="text-muted-foreground/60">-</span>;

const Row = (props: { data: Data; entry: Available }) => {
  const navigate = useNavigate();
  const guide = () => guideNamed(props.entry.name);
  const timing = () => props.data.timingFor(props.entry);

  return (
    <TableRow
      classList={{ "cursor-pointer": !!guide() }}
      onMouseEnter={(e) =>
        props.data.onHover(props.entry, e.currentTarget, e.clientX)
      }
      onMouseMove={(e) =>
        props.data.onHover(props.entry, e.currentTarget, e.clientX)
      }
      onMouseLeave={() => props.data.onLeave(props.entry)}
      onClick={(event) => {
        const found = guide();

        // Last run and the Guide chip are links of their own
        if (!found || (event.target as Element).closest("a, button")) {
          return;
        }

        props.data.onLeave(props.entry);
        navigate(guideHref(found.name), { state: { inApp: true } });
      }}
    >
      <TableCell>
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="h-8 w-14 shrink-0 rounded-sm bg-cover bg-center"
            style={{
              "background-image": tileArt(
                props.entry.pgcrImage,
                props.entry.typeName,
              ),
            }}
          />
          <div class="flex min-w-0 flex-col">
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate text-foreground">{props.entry.name}</span>
              <Show when={guide()}>
                {(found) => (
                  <Badge
                    as={A}
                    variant="outline"
                    href={guideHref(found().name)}
                    state={{ inApp: true }}
                    onClick={() => props.data.onLeave(props.entry)}
                  >
                    <span class="inline-block size-[1em]">
                      <MapGlyph />
                    </span>
                    Guide
                  </Badge>
                )}
              </Show>
            </span>
            <span class="truncate text-xs text-muted-foreground">
              {subline(props.entry)}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Show when={rung(props.entry)} fallback={<Dash />}>
          {(name) => name()}
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <Show when={power(props.entry)} fallback={<Dash />}>
          {(found) => found()}
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <span class="inline-flex items-center gap-2">
          <Icon icon={props.data.glyph()} class="size-(--icon-xs)" />
          <b class="text-foreground">{BASE_DROPS}</b>
          <Show when={props.entry.gear}>
            {(gear) => (
              <span
                classList={{
                  "font-semibold text-cream": topTier(gear()),
                  "text-muted-foreground": !topTier(gear()),
                }}
              >
                {gearText(gear())}
              </span>
            )}
          </Show>
          <Show when={props.entry.bonusDrops}>
            {(count) => <span class="text-cream">+{count()}</span>}
          </Show>
          <Show when={props.entry.dropsTaken}>
            {(count) => <span class={SPENT}>+{count()}</span>}
          </Show>
        </span>
      </TableCell>
      <TableCell>
        <Show when={rewardsOf(props.entry).length > 0} fallback={<Dash />}>
          <div class="flex min-w-0 items-center gap-4">
            <For each={rewardsOf(props.entry)}>
              {(one) => (
                <Named
                  loot={one.loot}
                  item={props.data.itemFor(one.loot)}
                  spent={one.spent}
                  onHide={() => props.data.onLeave(props.entry)}
                />
              )}
            </For>
          </div>
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <Show when={props.entry.challenges.length} fallback={<Dash />}>
          {(count) => (
            <span class="inline-flex items-center gap-1.5 text-cream">
              <ChallengeMark />
              {props.entry.challenges.filter((one) => !one.complete).length}/
              {count()}
            </span>
          )}
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <Show
          when={timing()}
          fallback={<span class="text-xs text-muted-foreground">Never run</span>}
        >
          {(found) => (
            <A
              href={props.data.hrefFor(found().lastRun)}
              class="group flex w-fit flex-col"
              onClick={() => props.data.onLeave(props.entry)}
            >
              <span class="group-hover:underline">
                {ago(found().lastRun.startedAt)}
              </span>
              <span class="text-xs text-muted-foreground">
                {found().runs} runs
                <Show when={found().fastestSeconds}>
                  {(fastest) => <> · {duration(fastest())}</>}
                </Show>
              </span>
            </A>
          )}
        </Show>
      </TableCell>
    </TableRow>
  );
};

const COLUMNS: { name: string; width: string }[] = [
  { name: "Activity", width: "" },
  { name: "Difficulty", width: "w-24" },
  { name: "Power", width: "w-24" },
  { name: "Drops", width: "w-32" },
  { name: "Rewards", width: "w-72" },
  { name: "Challenges", width: "w-24" },
  { name: "Last run", width: "w-32" },
];

interface TableProps {
  data: Data;
  sections: Section[];
}

const RunTable = (props: TableProps) => (
  <div class={TABLE_FRAME}>
    <Table class="table-fixed">
      <TableHeader class={TABLE_HEADER}>
        <TableRow>
          <For each={COLUMNS}>
            {(column) => (
              <TableHead class={column.width}>{column.name}</TableHead>
            )}
          </For>
        </TableRow>
      </TableHeader>
      <TableBody>
        <For each={props.sections}>
          {(section) => (
            <>
              <TableRow class="bg-muted/30 hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length} class="py-1.5">
                  <span class="flex items-baseline gap-2 text-xs">
                    <span class="font-medium text-foreground">
                      {section.name}
                    </span>
                    <span class="tabular-nums text-muted-foreground">
                      {section.entries.length}
                    </span>
                  </span>
                </TableCell>
              </TableRow>
              <For each={section.entries}>
                {(entry) => <Row data={props.data} entry={entry} />}
              </For>
            </>
          )}
        </For>
      </TableBody>
    </Table>
  </div>
);

const Challenges = (props: { challenges: Challenge[] }) => (
  <ul class="flex flex-col gap-1.5">
    <For each={props.challenges}>
      {(one) => (
        <li class="min-w-0" classList={{ [SPENT]: one.complete }}>
          <Show
            when={one.goal > 1}
            fallback={<span class="text-muted-foreground">{one.name}</span>}
          >
            <Objective
              label={one.name}
              progress={one.progress}
              goal={one.goal}
            />
          </Show>
        </li>
      )}
    </For>
  </ul>
);

export const ActivityFacts = (props: {
  entry: Available;
  values: Values;
  power: number | undefined;
}) => (
  <div class="flex flex-col gap-4 overflow-hidden">
    <Show when={props.entry.description}>
      <p class="text-muted-foreground">{props.entry.description}</p>
    </Show>
    <Show when={props.entry.locked.length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Locked</p>
        <ul class="flex flex-col gap-1 text-destructive">
          <For each={props.entry.locked}>
            {(one) => <li>{readable(one, props.values)}</li>}
          </For>
        </ul>
      </div>
    </Show>
    <Show when={props.entry.challenges.length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Challenges</p>
        <Challenges challenges={props.entry.challenges} />
      </div>
    </Show>
    <Show when={ladder(props.entry).length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Difficulty</p>
        <p>
          <For each={ladder(props.entry)}>
            {(one, index) => (
              <>
                <Show when={index() > 0}>
                  <span class="text-muted-foreground"> · </span>
                </Show>
                <span
                  classList={{
                    "text-muted-foreground/60":
                      one.tier !== undefined && barred(one.tier, props.power),
                  }}
                  title={
                    one.tier && barred(one.tier, props.power)
                      ? `${one.tier.power} power to launch`
                      : undefined
                  }
                >
                  {one.name}
                </span>
              </>
            )}
          </For>
        </p>
      </div>
    </Show>
    <Show when={doors(props.entry).length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Gear tier</p>
        <ul class="flex flex-col gap-1">
          <For each={doors(props.entry)}>
            {(door) => (
              <li class="flex items-baseline justify-between gap-4">
                <Show when={door.name}>
                  {(name) => (
                    <span class="text-muted-foreground">{name()}</span>
                  )}
                </Show>
                <span
                  classList={{ "text-cream": door.tier.low >= TOP_GEAR_TIER }}
                >
                  Tier{" "}
                  {door.tier.low === door.tier.high
                    ? door.tier.high
                    : `${door.tier.low}-${door.tier.high}`}
                </span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
    <Show when={props.entry.modifiers.length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Modifiers</p>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <For each={props.entry.modifiers}>
            {(one) => (
              <li class="min-w-0 text-xs">
                <div class="text-foreground">{one.name}</div>
                <Show when={one.description}>
                  <div class="text-muted-foreground">
                    {readable(one.description, props.values)}
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  </div>
);

const RunDetail = (props: { data: Data; hovered: Hovered }) => (
  <AnchoredPanel class={PANEL} cursorX={props.hovered.cursorX}>
    <div
      class="relative -mx-4 -mt-4 h-40 shrink-0 bg-cover bg-center"
      style={{
        "background-image": tileArt(
          props.hovered.entry.pgcrImage,
          props.hovered.entry.typeName,
        ),
      }}
    >
      <div class="absolute inset-x-0 bottom-0 flex flex-col bg-linear-to-t from-black/80 to-transparent px-4 pt-10 pb-3 text-shadow-art">
        <span class="text-base font-medium text-foreground">
          {props.hovered.entry.name}
        </span>
        <span class="text-foreground/70">{where(props.hovered.entry)}</span>
      </div>
    </div>
    <ActivityFacts
      entry={props.hovered.entry}
      values={props.data.values()}
      power={props.data.app.active()?.powerLevel}
    />
  </AnchoredPanel>
);

const Bonus = (props: { pieces: number; perk: number; values: Values }) => (
  <Show when={defs()?.SandboxPerk.getOptional(props.perk)}>
    {(perk) => (
      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-2">
          <span class="font-medium text-foreground">
            {perk().displayProperties.name}
          </span>
          <span class="text-xs text-muted-foreground">
            {props.pieces} pc
          </span>
        </div>
        <div class="whitespace-pre-line text-muted-foreground">
          {readable(perk().displayProperties.description, props.values)}
        </div>
      </div>
    )}
  </Show>
);

const SetBonuses = (props: { turn: Rotation; values: Values }) => (
  <Show when={defs()?.EquipableItemSet.getOptional(props.turn.set)}>
    {(set) => (
      <>
        <p class="text-muted-foreground">{set().displayProperties.name}</p>
        <For each={set().setPerks}>
          {(perk) => (
            <Bonus
              pieces={perk.requiredSetCount}
              perk={perk.sandboxPerkHash}
              values={props.values}
            />
          )}
        </For>
      </>
    )}
  </Show>
);

const zoneTime = (turn: Rotation, active: boolean, now: number): string =>
  active
    ? `Now · ${countdown(turn.start + HOUR - now)} left`
    : clock(turn.start);

const ZoneStrip = (props: { data: Data }) => {
  const [shown, setShown] = createSignal<Rotation | undefined>(undefined);

  const close = () => {
    releaseAnchor();
    setShown(undefined);
  };

  return (
    <div class="flex h-10 items-center gap-1 rounded-lg border px-2">
      <span class="px-1 text-muted-foreground">Distortion</span>
      <For each={props.data.turns().slice(0, STRIP_ZONES)}>
        {(turn, index) => (
          <span
            class="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-muted"
            onMouseEnter={(event) => {
              holdAnchor(event.currentTarget, close);
              setShown(turn);
            }}
            onMouseLeave={close}
          >
            <span
              classList={{
                "font-medium text-foreground": index() === 0,
                "text-muted-foreground": index() !== 0,
              }}
            >
              {turn.name}
            </span>
            <span
              class="tabular-nums"
              classList={{
                "text-light": index() === 0,
                "text-muted-foreground": index() !== 0,
              }}
            >
              {zoneTime(turn, index() === 0, props.data.now())}
            </span>
          </span>
        )}
      </For>
      <Show when={shown()}>
        {(turn) => (
          <AnchoredPanel class={PANEL}>
            <span class="text-base font-medium text-foreground">
              {turn().name}
            </span>
            <SetBonuses turn={turn()} values={props.data.values()} />
          </AnchoredPanel>
        )}
      </Show>
    </div>
  );
};

const Loading = (props: { data: Data }) => (
  <>
    <Show when={props.data.tables.error}>
      <p class="text-destructive">Activity definitions failed to load.</p>
    </Show>
    <Show when={props.data.realms().length === 0}>
      <p class="text-muted-foreground">
        <Show
          when={props.data.all().length > 0}
          fallback={<>Loading activities…</>}
        >
          Nothing matches that filter.
        </Show>
      </p>
    </Show>
  </>
);

export const Activities = () => {
  const data = createActivities();

  const sections = createMemo((): Section[] => {
    const realm = data.realm();

    if (!realm) {
      return [];
    }

    const picks = realm.categories
      .flatMap((one) => one.entries)
      .filter((one) => one.featured);
    const built: Section[] = [];

    if (picks.length > 0) {
      built.push({ name: FEATURED, entries: picks });
    }

    for (const category of realm.categories) {
      const entries = category.entries.filter((one) => !one.featured);

      if (entries.length > 0) {
        built.push({ name: category.name, entries });
      }
    }

    return built;
  });

  return (
    <div class="flex flex-col gap-3 p-4">
      <ZoneStrip data={data} />
      <Loading data={data} />
      <Show when={data.realms().length > 0}>
        <PickOne
          value={data.realm()?.name}
          options={data.realms().map((realm) => realm.name)}
          label={(name) => (
            <>
              {name}
              <BonusCount
                count={
                  data.realms().find((realm) => realm.name === name)
                    ?.bonusDrops ?? 0
                }
                glyph={data.glyph()}
              />
            </>
          )}
          onChange={data.pickRealm}
        />
        <RunTable data={data} sections={sections()} />
      </Show>
      <Show when={data.hovered()}>
        {(hovered) => <RunDetail data={data} hovered={hovered()} />}
      </Show>
    </div>
  );
};
