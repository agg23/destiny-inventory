import type { DimItem } from "app/inventory/item-types";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

import { DIFFICULTIES, difficultyOf, type SlimTier } from "@dvm/defs-core";

import {
  barred,
  BONUS_DROP_ITEM,
  categorize,
  matching,
  readable,
  tileArt,
  type Available,
  type Challenge,
  type Loot,
  type Matchmaking,
  type Realm,
} from "./activities.ts";
import { activityTables } from "./activityTables.ts";
import { fetchBaseline } from "./baseline.ts";
import { PageChrome } from "./chrome.tsx";
import { BUNGIE } from "./bungie.ts";
import { defs } from "./defs.ts";
import { countdown, HOUR, schedule, type Rotation } from "./distortion.ts";
import { ago, bestTiming, duration, type ActivityTiming } from "./history.ts";
import { clock } from "./history/runFormat.ts";
import type { CharacterActivities, StringVariables } from "./load.ts";
import { fakeItems } from "./fakeItems.ts";
import { dismiss, HOVER_DELAY, preview } from "./preview.ts";
import { useApp } from "./App.tsx";
import { useUrl } from "./router.ts";
import { AnchoredPanel } from "./ui/AnchoredPanel.tsx";
import { holdAnchor, releaseAnchor } from "./ui/anchor.ts";
import { Button } from "./ui/Button.tsx";
import { TabButton } from "./ui/TabButton.tsx";
import { LAYOUTS, type Layout } from "./url.ts";

type Values = Record<number, number>;

interface Section {
  name: string;
  entries: Available[];
}

const ALL = "All";

const LAYOUT_LABELS: Record<Layout, string> = {
  cards: "Cards",
  list: "List",
};

const FEATURED = "Featured";
const THIS_WEEK = "This week";
const NOTHING_LEFT = "Nothing left this week";

const REMAINING = "Bonus engrams left this week";
const TAKEN = "Taken this week";

const MATCHMAKING: Record<Matchmaking, string | undefined> = {
  required: "Matchmade",
  optional: "MM optional",
  none: undefined,
};

const MM_TITLE: Record<Matchmaking, string> = {
  required: "Matchmaking required",
  optional: "Matchmaking optional",
  none: "No matchmaking",
};

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

const Icon = (props: {
  icon: string | undefined;
  alt: string;
  class?: string;
}) => (
  <Show
    when={props.icon}
    fallback={<span class={`glyph bg-surface-raised ${props.class ?? ""}`} />}
  >
    {(icon) => (
      <img
        class={`glyph ${props.class ?? ""}`}
        src={`${BUNGIE}${icon()}`}
        alt={props.alt}
      />
    )}
  </Show>
);

interface NamedProps {
  loot: Loot;
  item?: DimItem;
  spent?: boolean;
  class?: string;
  onHide?: () => void;
}

const Named = (props: NamedProps) => {
  // Or the row under it re-anchors the activity panel onto this chip
  const track = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    event.stopPropagation();

    if (!props.item) {
      return;
    }

    props.onHide?.();
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
      class={`loot flex min-w-0 items-center gap-1.5 text-text ${
        props.class ?? ""
      }`}
      classList={{ spent: props.spent }}
      title={props.loot.name}
      onMouseEnter={track}
      onMouseMove={track}
      onMouseLeave={leave}
    >
      <Icon icon={props.loot.icon} alt="" class="size-(--icon-md)" />
      <span class="truncate">{props.loot.name}</span>
      <Show when={props.loot.quantity > 1}>
        <span class="text-dim">×{props.loot.quantity}</span>
      </Show>
    </span>
  );
};

interface RewardsProps {
  entry: Available;
  itemFor: (loot: Loot) => DimItem | undefined;
  class?: string;
  onHide: () => void;
}

const Rewards = (props: RewardsProps) => (
  <>
    <Show when={props.entry.focus}>
      {(focus) => (
        <Named
          loot={focus()}
          item={props.itemFor(focus())}
          class={props.class}
          onHide={props.onHide}
        />
      )}
    </Show>
    <For each={props.entry.bonus}>
      {(one) => (
        <Named
          loot={one}
          item={props.itemFor(one)}
          class={props.class}
          onHide={props.onHide}
        />
      )}
    </For>
    <Show when={props.entry.spentFocus}>
      {(focus) => (
        <Named
          loot={focus()}
          item={props.itemFor(focus())}
          spent
          class={props.class}
          onHide={props.onHide}
        />
      )}
    </Show>
    <For each={props.entry.spentBonus}>
      {(one) => (
        <Named
          loot={one}
          item={props.itemFor(one)}
          spent
          class={props.class}
          onHide={props.onHide}
        />
      )}
    </For>
  </>
);

// Nothing in the payload says this
const BASE_DROPS = 1;

const Drops = (props: { entry: Available; glyph: string | undefined }) => (
  <div class="progress-label m-0 w-full items-center justify-start gap-4 tabular-nums">
    <span class="inline-flex items-center gap-1.5">
      <Icon icon={props.glyph} alt="" class="size-(--icon-sm)" />
      <b>{BASE_DROPS}</b> drop
    </span>
    <Show when={props.entry.bonusDrops}>
      {(count) => (
        <span class="text-gold" title={REMAINING}>
          <b class="text-gold">+{count()}</b> bonus
        </span>
      )}
    </Show>
    <Show when={props.entry.dropsTaken}>
      {(count) => (
        <span class="spent text-gold" title={TAKEN}>
          <b class="text-gold">+{count()}</b> taken
        </span>
      )}
    </Show>
  </div>
);

const BonusCount = (props: { count: number; glyph: string | undefined }) => (
  <Show when={props.count}>
    {(count) => (
      <span
        class="ml-2 inline-flex items-center gap-1 text-gold"
        title={REMAINING}
      >
        <Icon icon={props.glyph} alt="" class="size-(--icon-xs)" />
        {count()}
      </span>
    )}
  </Show>
);

// No manifest objective carries an icon
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

const Challenges = (props: { challenges: Challenge[] }) => (
  <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-md text-muted">
    <For each={props.challenges}>
      {(one) => (
        <li class="min-w-0" classList={{ spent: one.complete }}>
          <Show
            when={one.goal > 1}
            fallback={<span class="challenge">{one.name}</span>}
          >
            <div class="progress objective">
              <span
                class="progress-fill"
                style={{
                  width: `${Math.min(1, one.progress / one.goal) * 100}%`,
                }}
              />
              <span class="progress-text">
                <span class="truncate">{one.name}</span>
                <span class="shrink-0 pl-2 tabular-nums">
                  {one.progress}/{one.goal}
                </span>
              </span>
            </div>
          </Show>
        </li>
      )}
    </For>
  </ul>
);

const Bonus = (props: { pieces: number; perk: number; values: Values }) => (
  <Show when={defs()?.SandboxPerk.getOptional(props.perk)}>
    {(perk) => (
      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-2">
          <span class="font-medium text-fg">
            {perk().displayProperties.name}
          </span>
          <span class="text-xs uppercase tracking-caps text-dim">
            {props.pieces} pc
          </span>
        </div>
        <div class="whitespace-pre-line text-muted">
          {readable(perk().displayProperties.description, props.values)}
        </div>
      </div>
    )}
  </Show>
);

interface ZoneProps {
  turn: Rotation;
  active: boolean;
  now: number;
  values: Values;
}

const ZoneCard = (props: ZoneProps) => (
  <li
    class="card flex flex-col"
    classList={{ active: props.active, "accent-exotic": props.active }}
  >
    <div class="card-header">
      <span class="card-title">{props.turn.name}</span>
      <span
        class="card-subtitle whitespace-nowrap tabular-nums"
        classList={{ "text-light": props.active }}
      >
        {props.active
          ? `Now · ${countdown(props.turn.start + HOUR - props.now)} left`
          : clock(props.turn.start)}
      </span>
    </div>
    <Show when={defs()?.EquipableItemSet.getOptional(props.turn.set)}>
      {(set) => (
        <div class="card-body flex flex-col gap-3">
          <p class="m-0 text-muted">{set().displayProperties.name}</p>
          <For each={set().setPerks}>
            {(perk) => (
              <Bonus
                pieces={perk.requiredSetCount}
                perk={perk.sandboxPerkHash}
                values={props.values}
              />
            )}
          </For>
        </div>
      )}
    </Show>
  </li>
);

interface Hovered {
  entry: Available;
  cursorX: number | undefined;
}

interface DetailProps extends Hovered {
  values: Values;
  power: number | undefined;
}

const RunDetail = (props: DetailProps) => (
  <AnchoredPanel class="card run-detail" cursorX={props.cursorX}>
    <div class="card-header flex-col items-start gap-1">
      <span class="card-title">{props.entry.name}</span>
      <span class="card-subtitle">{where(props.entry)}</span>
    </div>
    <div class="card-body flex flex-col gap-4 overflow-hidden">
      <Show when={props.entry.description}>
        <p class="m-0 text-md text-muted">{props.entry.description}</p>
      </Show>
      <Show when={props.entry.locked.length > 0}>
        <div class="flex flex-col gap-1.5">
          <p class="section-label">Locked</p>
          <ul class="m-0 flex list-none flex-col gap-1 p-0 text-md text-error">
            <For each={props.entry.locked}>
              {(one) => <li>{readable(one, props.values)}</li>}
            </For>
          </ul>
        </div>
      </Show>
      <Show when={props.entry.challenges.length > 0}>
        <div class="flex flex-col gap-1.5">
          <p class="section-label">Challenges</p>
          <Challenges challenges={props.entry.challenges} />
        </div>
      </Show>
      {/* Bungie states no per-rung power delta */}
      <Show when={props.entry.difficulties.length > 0}>
        <div class="flex flex-col gap-1.5">
          <p class="section-label">Difficulty</p>
          <p class="m-0 text-md text-text">
            <For each={props.entry.difficulties}>
              {(tier, index) => (
                <>
                  <Show when={index() > 0}>
                    <span class="text-dim"> · </span>
                  </Show>
                  <span
                    class="tier"
                    classList={{ barred: barred(tier, props.power) }}
                    title={
                      barred(tier, props.power)
                        ? `${tier.power} power to launch`
                        : undefined
                    }
                  >
                    {tier.name}
                  </span>
                </>
              )}
            </For>
          </p>
        </div>
      </Show>
      <Show when={props.entry.modifiers.length > 0}>
        <div class="flex flex-col gap-1.5">
          <p class="section-label">Modifiers</p>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            <For each={props.entry.modifiers}>
              {(one) => (
                <li class="min-w-0 text-sm">
                  <div class="text-text">{one.name}</div>
                  <Show when={one.description}>
                    <div class="text-muted">
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
  </AnchoredPanel>
);

const Played = (props: { timing: ActivityTiming | undefined }) => (
  <Show
    when={props.timing}
    fallback={<span class="card-subtitle text-dim">Never run</span>}
  >
    {(timing) => (
      <span class="card-subtitle tabular-nums">
        Last {ago(timing().lastRunAt)} · {timing().runs} runs
        <Show when={timing().fastestSeconds}>
          {(fastest) => <> · best {duration(fastest())}</>}
        </Show>
      </span>
    )}
  </Show>
);

interface RowProps {
  entry: Available;
  glyph: string | undefined;
  timing: ActivityTiming | undefined;
  itemFor: (loot: Loot) => DimItem | undefined;
  onHover: (entry: Available, element: HTMLElement, cursorX?: number) => void;
  onLeave: (entry: Available) => void;
}

const Row = (props: RowProps) => (
  <li
    class="card selectable run flex min-h-[260px] flex-col justify-between"
    style={{ "--art": tileArt(props.entry.pgcrImage, props.entry.typeName) }}
    onMouseEnter={(e) => props.onHover(props.entry, e.currentTarget)}
    onMouseLeave={() => props.onLeave(props.entry)}
  >
    <div class="flex items-start gap-2 p-3">
      <Show when={props.entry.challenges.length > 0}>
        <span
          class="badge inline-flex min-h-[1lh] items-center gap-1 text-gold"
          aria-label="Challenges"
        >
          <ChallengeMark />
          <Show when={props.entry.challenges.length > 1}>
            {props.entry.challenges.length}
          </Show>
        </span>
      </Show>
      <Show when={power(props.entry)}>
        {(level) => <span class="run-power">{level()}</span>}
      </Show>
    </div>
    <div class="card-header flex-col items-start gap-1.5 border-b-0">
      <span class="card-title line-clamp-2 max-w-full">{props.entry.name}</span>
      <span class="card-subtitle">
        {where(props.entry)}
        <Show when={MATCHMAKING[props.entry.matchmaking]}>
          {(label) => <> · {label()}</>}
        </Show>
      </span>
      <Played timing={props.timing} />
      <Drops entry={props.entry} glyph={props.glyph} />
      <div class="flex flex-wrap items-center gap-2 gap-x-4 text-md">
        <Rewards
          entry={props.entry}
          itemFor={props.itemFor}
          onHide={() => props.onLeave(props.entry)}
        />
      </div>
    </div>
  </li>
);

interface GridProps {
  entries: Available[];
  glyph: string | undefined;
  timingFor: (entry: Available) => ActivityTiming | undefined;
  itemFor: (loot: Loot) => DimItem | undefined;
  onHover: (entry: Available, element: HTMLElement, cursorX?: number) => void;
  onLeave: (entry: Available) => void;
  class?: string;
}

const RunGrid = (props: GridProps) => (
  <ul
    class={`m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-3 p-0 ${
      props.class ?? ""
    }`}
  >
    <For each={props.entries}>
      {(entry) => (
        <Row
          entry={entry}
          glyph={props.glyph}
          timing={props.timingFor(entry)}
          itemFor={props.itemFor}
          onHover={props.onHover}
          onLeave={props.onLeave}
        />
      )}
    </For>
  </ul>
);

interface TableSection {
  name: string;
  entries: Available[];
}

const COLUMNS = 10;

const ANY = "Any";

const NORMAL_RANK = DIFFICULTIES.indexOf("Normal");
const TOP_RANK = DIFFICULTIES.length - 1;

const wholeLadder = (tiers: SlimTier[]): boolean => {
  const first = DIFFICULTIES.indexOf(tiers[0]?.name ?? "");
  const last = DIFFICULTIES.indexOf(tiers[tiers.length - 1]?.name ?? "");

  return first >= 0 && first <= NORMAL_RANK && last === TOP_RANK;
};

const rung = (entry: Available): string | undefined => {
  const tiers = entry.difficulties;

  if (tiers.length === 0) {
    return difficultyOf(entry.name);
  }

  if (tiers.length === 1) {
    return tiers[0]?.name;
  }

  if (wholeLadder(tiers)) {
    return ANY;
  }

  return `${tiers[0]?.name} - ${tiers[tiers.length - 1]?.name}`;
};

const TableRow = (props: RowProps) => (
  <tr
    class="whitespace-nowrap"
    onMouseEnter={(e) => props.onHover(props.entry, e.currentTarget, e.clientX)}
    onMouseMove={(e) => props.onHover(props.entry, e.currentTarget, e.clientX)}
    onMouseLeave={() => props.onLeave(props.entry)}
  >
    <td
      class="plate"
      style={{ "--art": tileArt(props.entry.pgcrImage, props.entry.typeName) }}
    >
      <span class="block truncate text-lg text-fg">{props.entry.name}</span>
    </td>
    <td class="truncate">
      <Show
        when={props.entry.typeName}
        fallback={<span class="text-dim">-</span>}
      >
        {(name) => name()}
      </Show>
    </td>
    <td class="truncate">
      <Show
        when={props.entry.location}
        fallback={<span class="text-dim">-</span>}
      >
        {(name) => name()}
      </Show>
    </td>
    <td>
      <span
        class="mark"
        classList={{
          checked: props.entry.matchmaking === "required",
          indeterminate: props.entry.matchmaking === "optional",
        }}
        title={MM_TITLE[props.entry.matchmaking]}
      />
    </td>
    <td>
      <Show when={rung(props.entry)} fallback={<span class="text-dim">-</span>}>
        {(name) => (
          <span class="text-sm uppercase tracking-[0.12em]">{name()}</span>
        )}
      </Show>
    </td>
    <td class="tabular-nums">{power(props.entry) ?? "-"}</td>
    <td class="tabular-nums">
      <span class="inline-flex items-center gap-2">
        <Icon icon={props.glyph} alt="" class="size-(--icon-xs)" />
        <b>{BASE_DROPS}</b>
        <Show when={props.entry.bonusDrops}>
          {(count) => (
            <span class="text-gold" title={REMAINING}>
              +{count()}
            </span>
          )}
        </Show>
        <Show when={props.entry.dropsTaken}>
          {(count) => (
            <span class="spent text-gold" title={TAKEN}>
              +{count()}
            </span>
          )}
        </Show>
      </span>
    </td>
    <td class="relative p-0">
      {/* Absolute, or the chips cannot fill a cell whose height the row owns */}
      <div class="absolute inset-0 flex text-md">
        <Rewards
          entry={props.entry}
          itemFor={props.itemFor}
          onHide={() => props.onLeave(props.entry)}
          class="grow basis-0 px-4"
        />
      </div>
    </td>
    <td class="tabular-nums">
      <Show
        when={props.entry.challenges.length}
        fallback={<span class="text-dim">-</span>}
      >
        {(count) => (
          <span class="inline-flex items-center gap-1.5 text-gold">
            <ChallengeMark />
            {props.entry.challenges.filter((one) => !one.complete).length}/
            {count()}
          </span>
        )}
      </Show>
    </td>
    <td>
      <Show
        when={props.timing}
        fallback={<span class="text-sm text-dim">Never run</span>}
      >
        {(timing) => (
          <div class="flex flex-col text-sm tabular-nums">
            <span>{ago(timing().lastRunAt)}</span>
            <span class="text-dim">
              {timing().runs} runs
              <Show when={timing().fastestSeconds}>
                {(fastest) => <> · {duration(fastest())}</>}
              </Show>
            </span>
          </div>
        )}
      </Show>
    </td>
  </tr>
);

interface TableProps {
  sections: TableSection[];
  glyph: string | undefined;
  timingFor: (entry: Available) => ActivityTiming | undefined;
  itemFor: (loot: Loot) => DimItem | undefined;
  onHover: (entry: Available, element: HTMLElement, cursorX?: number) => void;
  onLeave: (entry: Available) => void;
}

const RunTable = (props: TableProps) => (
  <div class="card">
    <div class="card-body overflow-x-auto p-0">
      <table class="table activities">
        <thead>
          <tr class="whitespace-nowrap">
            <th class="w-64">Activity</th>
            <th class="w-36">Type</th>
            <th class="w-44">Location</th>
            <th class="w-16" title="Matchmaking">
              MM
            </th>
            <th class="w-32">Difficulty</th>
            <th class="w-24">Power</th>
            <th class="w-24">Drops</th>
            <th>Rewards</th>
            <th class="w-36">Challenges</th>
            <th class="w-32">Last run</th>
          </tr>
        </thead>
        <For each={props.sections}>
          {(section) => (
            <tbody>
              <tr class="day">
                <td colspan={COLUMNS}>
                  <span class="section-label">
                    {section.name}
                    <span class="text-sm normal-case tracking-normal tabular-nums text-dim">
                      {section.entries.length}
                    </span>
                  </span>
                </td>
              </tr>
              <For each={section.entries}>
                {(entry) => (
                  <TableRow
                    entry={entry}
                    glyph={props.glyph}
                    timing={props.timingFor(entry)}
                    itemFor={props.itemFor}
                    onHover={props.onHover}
                    onLeave={props.onLeave}
                  />
                )}
              </For>
            </tbody>
          )}
        </For>
      </table>
    </div>
  </div>
);

const offering = (entry: Available): boolean =>
  entry.bonusDrops > 0 ||
  entry.dropsTaken > 0 ||
  Boolean(entry.focus) ||
  entry.bonus.length > 0 ||
  entry.spentBonus.length > 0;

const listed = (entry: Available): boolean => !entry.focused && offering(entry);

const quiet = (entry: Available): boolean => !entry.focused && !offering(entry);

// A picked realm no director realm can collide with
const DISTORTION = "distortion-schedule";

export const Activities = () => {
  const app = useApp();
  const url = useUrl();
  const [tables] = createResource(activityTables);
  const character = () => app.active()?.id;
  const power = () => app.active()?.powerLevel;
  const realm = () => url.get("realm");
  const layout = () => url.get("layout");
  const section = () => url.get("section");
  const showRest = () => url.get("rest");
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);

  const onZones = () => realm() === DISTORTION;

  const [now, setNow] = createSignal(Date.now());
  const ticker = window.setInterval(() => setNow(Date.now()), 1000);

  onCleanup(() => window.clearInterval(ticker));

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

  const rows = () => {
    const loaded = tables();
    const held = character();
    const entries =
      held === undefined
        ? undefined
        : app.loaded()?.activities[held]?.availableActivities;

    return loaded && entries ? { loaded, entries: [...entries] } : undefined;
  };

  const [baseline] = createResource(tables, (loaded) =>
    fetchBaseline((hash) => loaded.rewards[hash]),
  );

  const all = (): Realm[] => {
    const found = rows();
    const held = baseline();

    if (!found) {
      return [];
    }

    return categorize(found.entries, found.loaded, (hash) => held?.rows[hash]);
  };

  const shown = createMemo(() => matching(all(), app.query()));

  const activeRealm = createMemo((): Realm | undefined => {
    const found = shown();

    return found.find((one) => one.name === realm()) ?? found[0];
  });

  const active = createMemo((): Section | undefined => {
    const realm = activeRealm();

    if (!realm) {
      return undefined;
    }

    const picked = realm.categories.find((one) => one.name === section());

    return (
      picked ?? {
        name: ALL,
        entries: realm.categories.flatMap((one) => one.entries),
      }
    );
  });

  const picks = createMemo(
    () => active()?.entries.filter((one) => one.focused) ?? [],
  );
  const weekly = createMemo(() => active()?.entries.filter(listed) ?? []);
  const rest = createMemo(() => active()?.entries.filter(quiet) ?? []);

  const sections = createMemo((): TableSection[] => {
    const built: TableSection[] = [];

    if (picks().length > 0) {
      built.push({ name: FEATURED, entries: picks() });
    }

    built.push({ name: THIS_WEEK, entries: weekly() });

    if (showRest() && rest().length > 0) {
      built.push({ name: NOTHING_LEFT, entries: rest() });
    }

    return built;
  });

  const values = (): Values =>
    (character() === undefined
      ? undefined
      : app.loaded()?.variables[character() ?? ""]) ?? {};

  const glyph = () => tables()?.rewards[BONUS_DROP_ITEM]?.icon;

  const timingFor = (entry: Available): ActivityTiming | undefined =>
    bestTiming(app.timings(), [
      entry.hash,
      ...entry.variants.map((one) => one.hash),
    ]);

  const rewardHashes = createMemo(() => {
    const found = new Set<number>();

    for (const entry of active()?.entries ?? []) {
      const loot = [
        entry.focus,
        entry.spentFocus,
        ...entry.bonus,
        ...entry.spentBonus,
      ];

      for (const one of loot) {
        if (one) {
          found.add(one.hash);
        }
      }
    }

    return [...found];
  });

  const [items] = createResource(
    () => {
      const loaded = app.loaded();
      const hashes = rewardHashes();

      return loaded && hashes.length > 0 ? { loaded, hashes } : undefined;
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
  );

  const itemFor = (loot: Loot): DimItem | undefined => items()?.get(loot.hash);

  return (
    <div class="flex flex-col gap-3 px-3 pt-3">
      <PageChrome
        tabs={
          <>
            <nav class="nav-subtabs">
              <For each={shown()}>
                {(one) => (
                  <TabButton
                    active={!onZones() && one.name === activeRealm()?.name}
                    onClick={() => {
                      // The card unmounts without a mouseleave
                      hide();
                      url.push({ realm: one.name, section: undefined });
                    }}
                  >
                    {one.name}
                    <BonusCount count={one.bonusDrops} glyph={glyph()} />
                  </TabButton>
                )}
              </For>
              <TabButton
                active={onZones()}
                onClick={() => {
                  hide();
                  url.push({ realm: DISTORTION, section: undefined });
                }}
              >
                Distortion
              </TabButton>
            </nav>
          </>
        }
        tools={
          <Show when={!onZones()}>
            <nav class="nav-facets">
              <For each={LAYOUTS}>
                {(one) => (
                  <TabButton
                    active={layout() === one}
                    onClick={() => {
                      hide();
                      url.push({ layout: one });
                    }}
                  >
                    {LAYOUT_LABELS[one]}
                  </TabButton>
                )}
              </For>
            </nav>
          </Show>
        }
      />

      <Show when={!onZones() && activeRealm()}>
        {(realm) => (
          <nav class="nav-facets">
            <TabButton
              active={active()?.name === ALL}
              onClick={() => {
                hide();
                url.push({ section: undefined });
              }}
            >
              {ALL}
              <BonusCount count={realm().bonusDrops} glyph={glyph()} />
            </TabButton>
            <For each={realm().categories}>
              {(one) => (
                <TabButton
                  active={one.name === active()?.name}
                  onClick={() => {
                    hide();
                    url.push({ section: one.name });
                  }}
                >
                  {one.name}
                  <BonusCount count={one.bonusDrops} glyph={glyph()} />
                </TabButton>
              )}
            </For>
          </nav>
        )}
      </Show>
      <Show when={tables.error}>
        <p class="text-danger">Activity definitions failed to load.</p>
      </Show>
      <Show
        when={active()}
        fallback={
          <p class="text-muted">
            <Show when={all().length > 0} fallback={<>Loading activities…</>}>
              Nothing matches that filter.
            </Show>
          </p>
        }
      >
        <>
          <Show when={onZones()}>
            <p class="m-0 text-md text-muted">
              Hourly rotation · every zone once in seven hours
            </p>
            <ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3 p-0">
              <For each={turns()}>
                {(turn, index) => (
                  <ZoneCard
                    turn={turn}
                    active={index() === 0}
                    now={now()}
                    values={values()}
                  />
                )}
              </For>
            </ul>
          </Show>
          <Show when={!onZones()}>
            <Show when={layout() === "list"}>
              <RunTable
                sections={sections()}
                glyph={glyph()}
                timingFor={timingFor}
                itemFor={itemFor}
                onHover={onHover}
                onLeave={onLeave}
              />
            </Show>
            <Show when={layout() === "cards"}>
              <Show when={picks().length > 0}>
                <RunGrid
                  class="picks"
                  entries={picks()}
                  glyph={glyph()}
                  timingFor={timingFor}
                  itemFor={itemFor}
                  onHover={onHover}
                  onLeave={onLeave}
                />
              </Show>
              <RunGrid
                entries={weekly()}
                glyph={glyph()}
                timingFor={timingFor}
                itemFor={itemFor}
                onHover={onHover}
                onLeave={onLeave}
              />
            </Show>
            <Show when={rest().length > 0}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                class="self-start"
                aria-pressed={showRest()}
                onClick={() => url.push({ rest: !showRest() })}
              >
                {showRest() ? "Hide" : "Show"} {rest().length} with nothing left
                this week
              </Button>
              <Show when={showRest() && layout() === "cards"}>
                <RunGrid
                  entries={rest()}
                  glyph={glyph()}
                  timingFor={timingFor}
                  itemFor={itemFor}
                  onHover={onHover}
                  onLeave={onLeave}
                />
              </Show>
            </Show>
          </Show>
        </>
      </Show>
      <Show when={hovered()}>
        {(panel) => (
          <RunDetail
            entry={panel().entry}
            cursorX={panel().cursorX}
            values={values()}
            power={power()}
          />
        )}
      </Show>
    </div>
  );
};
