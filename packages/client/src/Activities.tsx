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
  totalDrops,
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

const Icon = (props: { icon: string | undefined; alt: string }) => (
  <Show when={props.icon} fallback={<span class="glyph empty" />}>
    {(icon) => <img class="glyph" src={`${BUNGIE}${icon()}`} alt={props.alt} />}
  </Show>
);

const Named = (props: { loot: Loot; spent?: boolean }) => (
  <span class="loot" classList={{ spent: props.spent }} title={props.loot.name}>
    <Icon icon={props.loot.icon} alt="" />
    <span class="loot-name">{props.loot.name}</span>
    <Show when={props.loot.quantity > 1}>
      <span class="loot-count">×{props.loot.quantity}</span>
    </Show>
  </span>
);

// Every completion pays out once; nothing in the payload says so
const BASE_DROPS = 1;

// One sum in one place: what a run pays now, and what it would have paid before you took it
const Drops = (props: { entry: Available; glyph: string | undefined }) => (
  <span class="drops">
    <Icon icon={props.glyph} alt="" />
    <span class="drop-base">{BASE_DROPS}</span>
    <Show when={props.entry.bonusDrops}>
      {(count) => (
        <span class="drop-bonus" title={REMAINING}>
          +{count()} bonus
        </span>
      )}
    </Show>
    <Show when={props.entry.dropsTaken}>
      {(count) => (
        <span class="drop-bonus spent" title={TAKEN}>
          +{count()} bonus
        </span>
      )}
    </Show>
  </span>
);

// No objective in the manifest carries an icon, so the marker is drawn here
const ChallengeMark = () => (
  <svg class="mark" viewBox="0 0 16 16" aria-hidden="true">
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
  <ul class="run-challenges">
    <For each={props.challenges}>
      {(one) => (
        <li class="challenge" classList={{ spent: one.complete }}>
          <span class="challenge-name">{one.name}</span>
          <Show when={one.goal > 1}>
            <span class="challenge-progress">
              {one.progress}/{one.goal}
            </span>
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
      <div class="bonus">
        <div class="bonus-head">
          <span class="bonus-name">{perk().displayProperties.name}</span>
          <span class="bonus-pieces">{props.pieces} pc</span>
        </div>
        <div class="bonus-text">
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
  <li class="zone" classList={{ active: props.active }}>
    <div class="zone-top">
      <span class="zone-name">{props.turn.name}</span>
      <span class="zone-when">
        {props.active
          ? `Now · ${clock(props.turn.start + HOUR - props.now)} left`
          : when(props.turn.start)}
      </span>
    </div>
    <Show when={defs()?.EquipableItemSet.getOptional(props.turn.set)}>
      {(set) => (
        <div class="zone-body">
          <p class="zone-set">{set().displayProperties.name}</p>
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
const DETAIL_WIDTH = 340;
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
    <aside class="run-detail" ref={(el) => (panel = el)} style={position()}>
      <div class="run-detail-head">
        <div class="name">{props.entry.name}</div>
        <div class="meta">{where(props.entry)}</div>
      </div>
      <Show when={props.entry.description}>
        <p class="run-detail-text">{props.entry.description}</p>
      </Show>
      {/* First, because it is the one thing here that says you cannot have the drop at all */}
      <Show when={props.entry.locked.length > 0}>
        <div class="run-detail-block">
          <p class="label">Locked</p>
          <ul class="run-locked">
            <For each={props.entry.locked}>
              {(one) => <li>{readable(one, props.values)}</li>}
            </For>
          </ul>
        </div>
      </Show>
      <Show when={props.entry.challenges.length > 0}>
        <div class="run-detail-block">
          <p class="label">Challenges</p>
          <Challenges challenges={props.entry.challenges} />
        </div>
      </Show>
      {/* Names only: Bungie states no per-rung power delta anywhere in the manifest */}
      <Show when={props.entry.difficulties.length > 0}>
        <div class="run-detail-block">
          <p class="label">Difficulty</p>
          <p class="run-tiers">
            <For each={props.entry.difficulties}>
              {(tier, index) => (
                <>
                  <Show when={index() > 0}>
                    <span class="tier-split"> · </span>
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
        <div class="run-detail-block">
          <p class="label">Modifiers</p>
          <ul class="run-mods">
            <For each={props.entry.modifiers}>
              {(one) => (
                <li class="mod">
                  <Icon icon={one.icon} alt="" />
                  <div>
                    <div class="mod-name">{one.name}</div>
                    <Show when={one.description}>
                      <div class="mod-text">
                        {readable(one.description, props.values)}
                      </div>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
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
    class="run"
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
    <div class="run-top">
      <Show when={MATCHMAKING[props.entry.matchmaking]}>
        {(label) => <span class="badge">{label()}</span>}
      </Show>
      <Show when={props.entry.challenges.length > 0}>
        <span class="badge marked" aria-label="Challenges">
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
    <div class="run-foot">
      <div class="name">{props.entry.name}</div>
      <div class="meta">{where(props.entry)}</div>
      <div class="run-loot">
        <Drops entry={props.entry} glyph={props.glyph} />
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

interface Tab extends Category {
  realm: string;
}

// A picked() value no Portal section can collide with
const DISTORTION = "distortion-schedule";

export const Activities = (props: Props) => {
  const [tables] = createResource(activityTables);
  const [picked, setPicked] = createSignal<string | undefined>(undefined);
  const [showRest, setShowRest] = createSignal(false);
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);

  const onZones = () => picked() === DISTORTION;

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

  const tabs = createMemo((): Tab[] =>
    shown().flatMap((realm) =>
      realm.categories.map((category) => ({ ...category, realm: realm.name })),
    ),
  );

  // A filter can empty the section you were on, and an empty grid explains nothing
  const active = (): Tab | undefined => {
    const found = tabs();

    return found.find((one) => one.name === picked()) ?? found[0];
  };

  const values = (): Values =>
    (props.character ? props.variables[props.character] : undefined) ?? {};

  const glyph = () => tables()?.rewards[BONUS_DROP_ITEM]?.icon;

  return (
    <div class="activities">
      <h2>
        Available activities
        <Show when={totalDrops(shown())}>
          {(total) => (
            <span class="headline-drops" title={REMAINING}>
              <Icon icon={glyph()} alt="" />
              {total()} left this week
            </span>
          )}
        </Show>
      </h2>
      <Show when={tables.error}>
        <p class="error">Activity definitions failed to load.</p>
      </Show>
      <Show
        when={active()}
        fallback={
          <p class="meta">
            <Show when={all().length > 0} fallback={<>Loading activities…</>}>
              Nothing matches that filter.
            </Show>
          </p>
        }
      >
        {(current) => (
          <>
            <nav class="sections">
              <For each={tabs()}>
                {(tab, index) => (
                  <>
                    {/* The director's grouping survives as a rule between runs of tabs */}
                    <Show
                      when={
                        index() > 0 && tabs()[index() - 1]?.realm !== tab.realm
                      }
                    >
                      <span class="sections-split" />
                    </Show>
                    <button
                      type="button"
                      class="section-tab"
                      aria-pressed={!onZones() && tab.name === current().name}
                      onClick={() => setPicked(tab.name)}
                    >
                      {tab.name}
                      <Show when={tab.bonusDrops}>
                        {(count) => (
                          <span class="section-drops">
                            <Icon icon={glyph()} alt="" />
                            {count()}
                          </span>
                        )}
                      </Show>
                    </button>
                  </>
                )}
              </For>
              <span class="sections-split" />
              <button
                type="button"
                class="section-tab"
                aria-pressed={onZones()}
                onClick={() => setPicked(DISTORTION)}
              >
                Distortion · {turns()[0]?.short ?? turns()[0]?.name}
                <span class="section-drops tab-clock">
                  {clock((turns()[0]?.start ?? now()) + HOUR - now())}
                </span>
              </button>
            </nav>
            <Show when={onZones()}>
              <p class="sections-note">
                Hourly rotation · every zone once in seven hours
              </p>
              <ul class="zones">
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
              <p class="sections-note">
                {current().realm} · {current().entries.length} activities
              </p>
              {/* What the week is pushing, which is the reason to open the tab at all */}
              <Show when={current().entries.filter((one) => one.focused)}>
                {(picks) => (
                  <Show when={picks().length > 0}>
                    <p class="label">Featured</p>
                    <ul class="runs picks">
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
              <ul class="runs">
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
                      class="more"
                      aria-pressed={showRest()}
                      onClick={() => setShowRest(!showRest())}
                    >
                      {showRest() ? "Hide" : "Show"} {rest().length} with
                      nothing left this week
                    </button>
                    <Show when={showRest()}>
                      <ul class="runs">
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
