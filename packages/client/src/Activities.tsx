import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

import type { SlimTier } from "@dvm/defs-core";

import {
  barred,
  BONUS_DROP_ITEM,
  categorize,
  matching,
  readable,
  type Available,
  type Category,
  type Challenge,
  type Loot,
  type Matchmaking,
  type Realm,
} from "./activities.ts";
import { activityTables } from "./activityTables.ts";
import { fetchBaseline } from "./baseline.ts";
import { defs } from "./defs.ts";
import { clock, HOUR, schedule, type Rotation } from "./distortion.ts";
import type { CharacterActivities, StringVariables } from "./load.ts";
import { BUNGIE } from "./ItemPanel.tsx";

interface Props {
  activities: CharacterActivities;
  variables: StringVariables;
  character: string | undefined;
  power: number | undefined;
  query: string;
}

type Values = Record<number, number>;

const REMAINING = "Bonus engrams left this week";
const TAKEN = "Taken this week";

// Nothing for a premade fireteam, the default that says nothing worth the space
const MATCHMAKING: Record<Matchmaking, string | undefined> = {
  required: "Matchmade",
  optional: "MM optional",
  none: undefined,
};

// A folded row spans two power levels, and the lower one is what the customized door asks
const power = (entry: Available): string | undefined => {
  if (entry.power === undefined || entry.topPower === undefined) {
    return undefined;
  }

  return entry.power === entry.topPower
    ? String(entry.power)
    : `${entry.power}–${entry.topPower}`;
};

// One line, always in the same place, so the eye can skip it when it is looking for loot
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

const Named = (props: { loot: Loot; spent?: boolean }) => (
  <span
    class="loot inline-flex min-w-0 items-center gap-1.5 text-text"
    classList={{ spent: props.spent }}
    title={props.loot.name}
  >
    <Icon icon={props.loot.icon} alt="" class="size-(--icon-md)" />
    <span class="truncate">{props.loot.name}</span>
    <Show when={props.loot.quantity > 1}>
      <span class="text-dim">×{props.loot.quantity}</span>
    </Show>
  </span>
);

// Every completion pays out once; nothing in the payload says so
const BASE_DROPS = 1;

// One sum in one place: what a run pays now, and what it would have paid before you took it.
// The framework's progress label, so the numbers read as the same kind of text as the title
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

// What a tab still owes you this week, which is what makes you open it
const BonusCount = (props: { count: number; glyph: string | undefined }) => (
  <Show when={props.count}>
    {(count) => (
      <span
        class="ml-2 inline-flex items-center gap-1 text-md tracking-base text-gold"
        title={REMAINING}
      >
        <Icon icon={props.glyph} alt="" class="size-(--icon-xs)" />
        {count()}
      </span>
    )}
  </Show>
);

// No objective in the manifest carries an icon, so the marker is drawn here
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

// A counted objective is what the game draws as a bar, so it gets the framework's own
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

const when = (start: number): string =>
  new Date(start).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const Bonus = (props: { pieces: number; perk: number; values: Values }) => (
  <Show when={defs()?.SandboxPerk.getOptional(props.perk)}>
    {(perk) => (
      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-2">
          <span class="font-medium text-fg">{perk().displayProperties.name}</span>
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
          ? `Now · ${clock(props.turn.start + HOUR - props.now)} left`
          : when(props.turn.start)}
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

const GAP = 8;
// The framework's own tooltip and card width
const DETAIL_WIDTH = 352;
const HOVER_DELAY = 120;

interface Hovered {
  entry: Available;
  anchor: DOMRect;
}

interface DetailProps extends Hovered {
  values: Values;
  power: number | undefined;
}

// One panel the grid moves around: a tooltip per card would be two hundred of them
const RunDetail = (props: DetailProps) => {
  const [height, setHeight] = createSignal(0);

  let panel: HTMLElement | undefined = undefined;

  // A raid with six modifiers is twice the height of a playlist, and the panel cannot scroll
  createEffect(() => {
    props.entry;
    setHeight(panel?.offsetHeight ?? 0);
  });

  const position = createMemo(() => {
    const room = window.innerWidth - props.anchor.right;
    const left =
      room > DETAIL_WIDTH + GAP
        ? props.anchor.right + GAP
        : props.anchor.left - DETAIL_WIDTH - GAP;

    return {
      left: `${Math.max(GAP, left)}px`,
      top: `${Math.max(
        GAP,
        Math.min(props.anchor.top, window.innerHeight - height() - GAP),
      )}px`,
      width: `${DETAIL_WIDTH}px`,
    };
  });

  return (
    <aside class="card run-detail" ref={(el) => (panel = el)} style={position()}>
      <div class="card-header flex-col items-start gap-1">
        <span class="card-title">{props.entry.name}</span>
        <span class="card-subtitle">{where(props.entry)}</span>
      </div>
      <div class="card-body flex flex-col gap-4 overflow-hidden">
      <Show when={props.entry.description}>
        <p class="m-0 text-md text-muted">{props.entry.description}</p>
      </Show>
      {/* First, because it is the one thing here that says you cannot have the drop at all */}
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
      {/* Names only: Bungie states no per-rung power delta anywhere in the manifest */}
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
    </aside>
  );
};

interface RowProps {
  entry: Available;
  glyph: string | undefined;
  onHover: (entry: Available, anchor: DOMRect) => void;
  onLeave: (entry: Available) => void;
}

const Row = (props: RowProps) => (
  <li
    class="card selectable run flex min-h-[260px] flex-col justify-between"
    style={
      props.entry.pgcrImage
        ? { "--art": `url(${BUNGIE}${props.entry.pgcrImage})` }
        : undefined
    }
    onMouseEnter={(e) =>
      props.onHover(props.entry, e.currentTarget.getBoundingClientRect())
    }
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
    {/* The card's own header block, at the foot of the art the way the Director draws it. One
        typographic register per line rather than caps and sentence case sharing one */}
    <div class="card-header flex-col items-start gap-1.5 border-b-0">
      <span class="card-title line-clamp-2 max-w-full">{props.entry.name}</span>
      <span class="card-subtitle">
        {where(props.entry)}
        <Show when={MATCHMAKING[props.entry.matchmaking]}>
          {(label) => <> · {label()}</>}
        </Show>
      </span>
      <Drops entry={props.entry} glyph={props.glyph} />
      {/* Loot is proper nouns, so it keeps sentence case and takes a line of its own */}
      <div class="flex flex-wrap items-center gap-2 gap-x-4 text-md">
        <Show when={props.entry.focus}>
          {(focus) => <Named loot={focus()} />}
        </Show>
        <For each={props.entry.bonus}>{(one) => <Named loot={one} />}</For>
        {/* Kept so the row still says what it is worth to anyone who has not run it */}
        <Show when={props.entry.spentFocus}>
          {(focus) => <Named loot={focus()} spent />}
        </Show>
        <For each={props.entry.spentBonus}>
          {(one) => <Named loot={one} spent />}
        </For>
      </div>
    </div>
  </li>
);

// Whether the week still owes this activity anything, which is what decides the two lists
const offering = (entry: Available): boolean =>
  entry.bonusDrops > 0 ||
  entry.dropsTaken > 0 ||
  Boolean(entry.focus) ||
  entry.bonus.length > 0 ||
  entry.spentBonus.length > 0;

// Featured runs above both lists, so neither one repeats it
const listed = (entry: Available): boolean => !entry.focused && offering(entry);

const quiet = (entry: Available): boolean => !entry.focused && !offering(entry);

// A picked realm no director realm can collide with
const DISTORTION = "distortion-schedule";

export const Activities = (props: Props) => {
  const [tables] = createResource(activityTables);
  const [realm, setRealm] = createSignal<string | undefined>(undefined);
  const [section, setSection] = createSignal<string | undefined>(undefined);
  const [showRest, setShowRest] = createSignal(false);
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);

  const onZones = () => realm() === DISTORTION;

  const [now, setNow] = createSignal(Date.now());
  const ticker = window.setInterval(() => setNow(Date.now()), 1000);

  onCleanup(() => window.clearInterval(ticker));

  // Keyed to the hour so the tick redraws one countdown, not seven cards
  const hour = createMemo(() => Math.floor(now() / HOUR));
  const turns = createMemo(() => schedule(hour() * HOUR));

  let hoverTimer: number | undefined = undefined;

  // The delay is what keeps the panel from strobing as the pointer crosses the grid
  const onHover = (entry: Available, anchor: DOMRect) => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(
      () => setHovered({ entry, anchor }),
      HOVER_DELAY,
    );
  };

  const onLeave = (entry: Available) => {
    window.clearTimeout(hoverTimer);

    if (hovered()?.entry.key === entry.key) {
      setHovered(undefined);
    }
  };

  const rows = () => {
    const loaded = tables();
    const entries = props.character
      ? props.activities[props.character]?.availableActivities
      : undefined;

    return loaded && entries ? { loaded, entries: [...entries] } : undefined;
  };

  // Reward names live in the activity tables, so the baseline is read once those have landed
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

  const shown = createMemo(() => matching(all(), props.query));

  // A filter can empty the realm or the section you were on, and an empty grid explains
  // nothing, so each level falls back to its first survivor
  const activeRealm = createMemo((): Realm | undefined => {
    const found = shown();

    return found.find((one) => one.name === realm()) ?? found[0];
  });

  const active = createMemo((): Category | undefined => {
    const categories = activeRealm()?.categories ?? [];

    return categories.find((one) => one.name === section()) ?? categories[0];
  });

  const values = (): Values =>
    (props.character ? props.variables[props.character] : undefined) ?? {};

  const glyph = () => tables()?.rewards[BONUS_DROP_ITEM]?.icon;

  return (
    <div class="flex flex-col gap-3 px-4 pt-3">
      {/* The director's own two levels: realms lead, the sections inside one follow. Both are
          the framework's nav components, so the weight difference does the explaining */}
      <nav class="nav-tabs">
        <For each={shown()}>
          {(one) => (
            <button
              type="button"
              class="nav-tab"
              classList={{ active: !onZones() && one.name === activeRealm()?.name }}
              aria-pressed={!onZones() && one.name === activeRealm()?.name}
              onClick={() => {
                // The card under the pointer unmounts without a mouseleave, so its panel
                // would hang around over the realm you just switched to
                setHovered(undefined);
                setRealm(one.name);
                setSection(undefined);
              }}
            >
              {one.name}
              <BonusCount count={one.bonusDrops} glyph={glyph()} />
            </button>
          )}
        </For>
        <button
          type="button"
          class="nav-tab"
          classList={{ active: onZones() }}
          aria-pressed={onZones()}
          onClick={() => {
            setHovered(undefined);
            setRealm(DISTORTION);
          }}
        >
          Distortion
        </button>
      </nav>
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
        {(current) => (
          <>
            <Show when={!onZones()}>
              <nav class="nav-subtabs sections">
                <For each={activeRealm()?.categories}>
                  {(one) => (
                    <button
                      type="button"
                      class="nav-tab"
                      classList={{ active: one.name === current().name }}
                      aria-pressed={one.name === current().name}
                      onClick={() => {
                        setHovered(undefined);
                        setSection(one.name);
                      }}
                    >
                      {one.name}
                      <BonusCount count={one.bonusDrops} glyph={glyph()} />
                    </button>
                  )}
                </For>
              </nav>
            </Show>
            <Show when={onZones()}>
              {/* The live zone and its clock are on the first card, which says it better */}
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
              {/* What the week is pushing, which is the reason to open the tab at all */}
              <Show when={current().entries.filter((one) => one.focused)}>
                {(picks) => (
                  <Show when={picks().length > 0}>
                    <p class="section-label">Featured</p>
                    <ul class="picks m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-3 p-0">
                      <For each={picks()}>
                        {(entry) => (
                          <Row
                            entry={entry}
                            glyph={glyph()}
                            onHover={onHover}
                            onLeave={onLeave}
                          />
                        )}
                      </For>
                    </ul>
                  </Show>
                )}
              </Show>
              <ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-3 p-0">
                <For each={current().entries.filter(listed)}>
                  {(entry) => (
                    <Row
                      entry={entry}
                      glyph={glyph()}
                      onHover={onHover}
                      onLeave={onLeave}
                    />
                  )}
                </For>
              </ul>
              {/* The rest are still here, just not competing with what the week owes you */}
              <Show when={current().entries.filter(quiet)}>
                {(rest) => (
                  <Show when={rest().length > 0}>
                    <button
                      type="button"
                      class="button small ghost self-start"
                      aria-pressed={showRest()}
                      onClick={() => setShowRest(!showRest())}
                    >
                      {showRest() ? "Hide" : "Show"} {rest().length} with
                      nothing left this week
                    </button>
                    <Show when={showRest()}>
                      <ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-3 p-0">
                        <For each={rest()}>
                          {(entry) => (
                            <Row
                              entry={entry}
                              glyph={glyph()}
                              onHover={onHover}
                              onLeave={onLeave}
                            />
                          )}
                        </For>
                      </ul>
                    </Show>
                  </Show>
                )}
              </Show>
            </Show>
          </>
        )}
      </Show>
      <Show when={hovered()}>
        {(panel) => (
          <RunDetail
            entry={panel().entry}
            anchor={panel().anchor}
            values={values()}
            power={props.power}
          />
        )}
      </Show>
    </div>
  );
};
