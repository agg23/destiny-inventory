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

const MATCHMAKING: Record<Matchmaking, string | undefined> = {
  required: "Matchmade",
  optional: "MM optional",
  none: undefined,
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
        class="ml-2 inline-flex items-center gap-1 text-md tracking-base text-gold"
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

const RunDetail = (props: DetailProps) => {
  const [height, setHeight] = createSignal(0);

  let panel: HTMLElement | undefined = undefined;

  // The panel cannot scroll
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
    <aside
      class="card run-detail"
      ref={(el) => (panel = el)}
      style={position()}
    >
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
    <div class="card-header flex-col items-start gap-1.5 border-b-0">
      <span class="card-title line-clamp-2 max-w-full">{props.entry.name}</span>
      <span class="card-subtitle">
        {where(props.entry)}
        <Show when={MATCHMAKING[props.entry.matchmaking]}>
          {(label) => <> · {label()}</>}
        </Show>
      </span>
      <Drops entry={props.entry} glyph={props.glyph} />
      <div class="flex flex-wrap items-center gap-2 gap-x-4 text-md">
        <Show when={props.entry.focus}>
          {(focus) => <Named loot={focus()} />}
        </Show>
        <For each={props.entry.bonus}>{(one) => <Named loot={one} />}</For>
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

  const hour = createMemo(() => Math.floor(now() / HOUR));
  const turns = createMemo(() => schedule(hour() * HOUR));

  let hoverTimer: number | undefined = undefined;

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
      <nav class="nav-tabs">
        <For each={shown()}>
          {(one) => (
            <button
              type="button"
              class="nav-tab"
              classList={{
                active: !onZones() && one.name === activeRealm()?.name,
              }}
              aria-pressed={!onZones() && one.name === activeRealm()?.name}
              onClick={() => {
                // The card unmounts without a mouseleave
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
