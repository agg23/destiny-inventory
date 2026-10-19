import type { DimItem } from "app/inventory/item-types";
import {
  createEffect,
  createMemo,
  createResource,
  For,
  Show,
  type JSX,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";

import { Select } from "../components/lib/Select.tsx";
import { HEADING, SECTION } from "../components/lib/text.ts";
import { Button } from "../components/lib/zaidan/button.tsx";
import { activityLookup } from "../core/activities/activityLookup.ts";
import { baseName } from "../core/activities/activityNames.ts";
import { useActivityTables } from "../core/activities/activityTables.ts";
import { useApp } from "../core/app/state.ts";
import { useClock } from "../core/clock.ts";
import { dismiss, preview } from "../core/items/preview.ts";
import { defs } from "../core/profile/defs.ts";
import { fakeItems, rebuiltItems } from "../core/profile/fakeItems.ts";
import { useUrl } from "../core/router.ts";
import { ORBIT, runOf, spansOf, type Span } from "../core/stats/attribute.ts";
import {
  changesBetween,
  lastObserved,
  statsVersion,
} from "../core/stats/log.ts";
import type { Change } from "../core/stats/types.ts";
import { plural } from "../core/text.ts";
import { DAY, dayTitle, shortTime, span as timeSpan } from "../core/time.ts";
import { runHref } from "../core/url.ts";
import {
  ActivityList,
  cardId,
  combat,
  DigestBody,
  digestFacts,
  digestTitle,
} from "./shared/ActivityList.tsx";
import { CurrencyView, type ChartSpan } from "./shared/CurrencyView.tsx";
import { demoChanges, statsDemo } from "./shared/demo.ts";
import { MainCurrencies, type MainCurrency } from "./shared/MainCurrencies.tsx";
import {
  DayStrip,
  DaysStrip,
  type StripBlock,
  type StripMark,
} from "./shared/PlayStrip.tsx";
import {
  activityDigestsOf,
  balancesOf,
  dropsOf,
  earningsOf,
  flowsOf,
  killBarsOf,
  LOOKBACK,
  MAIN_CURRENCIES,
  nextMidnight,
  PERIODS,
  playDaysOf,
  spanFlowsOf,
  spanKey,
  weaponKillsOf,
  type ActivityDigest,
  type KillBar,
  type PlayDay,
  type WeaponKills,
} from "./shared/statData.ts";
import { intervalFor, timelineOf } from "./shared/timeline.ts";
import { WeaponKillTable } from "./shared/WeaponKillTable.tsx";
import { WeaponView, type KillSpan } from "./shared/WeaponView.tsx";

const PAGE = 40;

// Mode 40 is Social, orbit has no modes at all
const SOCIAL_MODE = 40;

const CHOSEN_DAY = "day";

const DAY_ACTIVITIES = 8;

// Every weapon unchecked, since an empty pick means all of them
const NONE = "none";

const PERIOD_NAMES: Record<string, string> = Object.fromEntries(
  PERIODS.map((one) => [one.id, one.label]),
);

export const Stats = () => {
  const app = useApp();
  const url = useUrl();
  const tables = useActivityTables();
  const clock = useClock();

  const period = () =>
    PERIODS.find((one) => one.id === url.get("period")) ?? PERIODS[0]!;

  const range = (): { from: number; to: number; label: string } => {
    const day = url.get("day");
    const start =
      day === undefined ? Number.NaN : Date.parse(`${day}T00:00:00`);

    if (day !== undefined && !Number.isNaN(start)) {
      return {
        from: start,
        to: Math.min(nextMidnight(start) - 1, Date.now()),
        label: dayTitle(day),
      };
    }

    const to = Date.now();

    return {
      from: Math.max(0, to - period().length),
      to,
      label: period().label,
    };
  };

  const own = () => {
    const loaded = app.loaded();

    return loaded && !loaded.session.guest ? loaded : undefined;
  };

  const [recorded] = createResource(
    () => {
      const loaded = own();

      return loaded
        ? {
            loaded,
            day: url.get("day"),
            period: period(),
            version: statsVersion(),
          }
        : undefined;
    },
    async ({ loaded }) => {
      const { from, to } = range();

      const observed = await lastObserved(
        loaded.session.store,
        loaded.session.membership.membershipId,
      );

      if (statsDemo()) {
        return {
          changes: demoChanges(app.stores(), app.runs(), Date.now()),
          from,
          to,
          observed,
        };
      }

      const changes = await changesBetween(
        loaded.session.store,
        loaded.session.membership.membershipId,
        Math.max(0, from - LOOKBACK),
        to,
      );

      return { changes, from, to, observed };
    },
  );

  const needle = () => app.query().trim().toLowerCase();

  // Fresh arrays remount every tile and chart
  const [shown, setShown] = createStore<{
    weapons: WeaponKills[];
    digests: ActivityDigest[];
  }>({ weapons: [], digests: [] });

  const [fakes] = createResource(
    () => {
      const loaded = own();
      const held = recorded();

      if (!loaded || !held) {
        return undefined;
      }

      const hashes = held.changes.flatMap((change) =>
        "itemHash" in change ? [change.itemHash] : [],
      );

      return { loaded, hashes: [...new Set([...hashes, ...MAIN_CURRENCIES])] };
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
  );

  const nameOf = (hash: number): string =>
    fakes()?.get(hash)?.name ??
    defs()?.InventoryItem.getOptional(hash)?.displayProperties.name ??
    `Item ${hash}`;

  const heldById = createMemo(
    () =>
      new Map(
        app
          .stores()
          .flatMap((store) => store.items)
          .map((item) => [item.id, item]),
      ),
  );

  const [rebuilt] = createResource(
    () => {
      const loaded = own();
      const held = recorded();

      if (!loaded || !held) {
        return undefined;
      }

      const snapshots = held.changes.flatMap((change) =>
        change.kind === "item" &&
        change.snapshot &&
        !heldById().has(change.instanceId)
          ? [change.snapshot]
          : [],
      );

      return snapshots.length > 0 ? { loaded, snapshots } : undefined;
    },
    ({ loaded, snapshots }) => rebuiltItems(loaded, snapshots),
  );

  // The live item, then the logged roll, then a bare copy by hash
  const instanceOf = (instanceId: string, itemHash: number) =>
    heldById().get(instanceId) ??
    rebuilt()?.get(instanceId) ??
    fakes()?.get(itemHash);

  const spanName = (span: Span): string => {
    const found = tables()?.activities[span.activityHash];

    if (found?.name) {
      return baseName(found);
    }

    const place =
      found?.placeHash === undefined
        ? undefined
        : tables()?.places[found.placeHash]?.name;

    return place || `Activity ${span.activityHash}`;
  };

  const lookup = createMemo(() => activityLookup(tables()));

  const spanLabel = (span: Span): string => {
    const run = runOf(span, app.runs());
    const rung = run
      ? lookup().rungOf(run)
      : tables()?.activities[span.activityHash]?.difficulty;

    return rung ? `${spanName(span)}: ${rung}` : spanName(span);
  };

  const spanHref = (span: Span): string | undefined => {
    const run = runOf(span, app.runs());

    return run
      ? runHref(lookup().labelOf(run), lookup().rungOf(run), run.instanceId)
      : undefined;
  };

  const social = (span: Span): boolean =>
    span.activityHash === ORBIT ||
    !!tables()?.activities[span.activityHash]?.modeTypes.includes(SOCIAL_MODE);

  const classOf = (characterId: string): string | undefined =>
    app.stores().find((store) => store.id === characterId)?.className;

  // Bungie only reports deaths per finished run
  const deathsOf = (span: Span): number | undefined =>
    runOf(span, app.runs())?.deaths;

  createEffect(() => {
    const held = recorded();

    if (!held) {
      return;
    }

    const matches = (name: string) =>
      needle() === "" || name.toLowerCase().includes(needle());

    setShown(
      "weapons",
      reconcile(
        weaponKillsOf(held.changes, held.from).filter((weapon) =>
          matches(nameOf(weapon.itemHash)),
        ),
        { key: "instanceId" },
      ),
    );
    setShown(
      "digests",
      reconcile(
        activityDigestsOf(held.changes, held.from, held.to).filter(
          (digest) =>
            !digest.span ||
            matches(spanName(digest.span)) ||
            digest.events.some(
              (event) =>
                event.kind !== "drops" ||
                event.drops.some((drop) => matches(nameOf(drop.itemHash))),
            ),
        ),
        { key: "key" },
      ),
    );
  });

  const spans = createMemo(() => {
    const held = recorded();

    return held ? spansOf(held.changes) : [];
  });

  const oneDay = () => {
    const held = recorded();

    return !!held && held.to - held.from <= DAY;
  };

  // Not the clock, a ticking memo rebuilds the strip and drops its hover
  const strip = createMemo(() => {
    const held = recorded();

    if (!held) {
      return undefined;
    }

    const now = held.to;
    const inRange = spans().filter(
      (span) =>
        span.startedAt <= held.to &&
        (span.endedAt === undefined || span.endedAt >= held.from),
    );
    const blocks: StripBlock[] = inRange.map((span) => ({
      key: spanKey(span),
      startedAt: Math.max(span.startedAt, held.from),
      endedAt: Math.min(span.endedAt ?? now, now),
      name: spanName(span),
      social: social(span),
    }));

    if (blocks.length === 0) {
      return undefined;
    }

    const marks: StripMark[] = [];
    const details = new Map<string, { item: DimItem; notes: string[] }>();

    for (const digest of shown.digests) {
      const where = digestTitle(digest, spanName);

      for (const event of digest.events) {
        if (event.kind === "drops") {
          for (const drop of event.drops) {
            const item = instanceOf(drop.instanceId, drop.itemHash);
            const key = `${event.key}/${drop.instanceId}`;

            marks.push({
              key,
              at: drop.at,
              color: `var(--color-${(item?.rarity ?? "common").toLowerCase()})`,
              dismantle: false,
            });

            if (item) {
              details.set(key, {
                item,
                notes: [
                  `Dropped in ${where} at ${shortTime(drop.at)}`,
                  ...(drop.alternative
                    ? [`Or ${spanName(drop.alternative)}`]
                    : []),
                ],
              });
            }
          }
        }

        if (event.kind === "dismantle") {
          const item = instanceOf(event.instanceId, event.itemHash);
          const dropped = event.dropped;

          marks.push({
            key: event.key,
            at: event.at,
            color: "",
            dismantle: true,
          });

          if (item) {
            details.set(event.key, {
              item,
              notes: [
                `Dismantled in ${where} at ${shortTime(event.at)}`,
                ...(dropped
                  ? [
                      `Dropped in ${dropped.span ? spanName(dropped.span) : "an unrecorded activity"} at ${shortTime(dropped.at)}`,
                    ]
                  : []),
              ],
            });
          }
        }
      }
    }

    return {
      timeline: timelineOf(
        blocks.map((block) => ({ from: block.startedAt, to: block.endedAt })),
      ),
      blocks,
      marks,
      details,
      inRange,
      days: playDaysOf(inRange, held.from, now, social),
    };
  });

  const blockPanel = (key: string): JSX.Element => {
    const digest = shown.digests.find((one) => one.key === key);
    const span = strip()?.inRange.find((one) => spanKey(one) === key);

    return (
      <>
        <div class="flex flex-col gap-0.5">
          <span class="text-base font-medium text-foreground">
            {span ? spanName(span) : ""}
          </span>
          <span class="text-xs text-muted-foreground tabular-nums">
            {digest
              ? [
                  ...digestFacts(digest, recorded()?.to ?? Date.now(), classOf),
                  combat(digest.kills, span ? deathsOf(span) : undefined) ?? "",
                ]
                  .filter((fact) => fact !== "")
                  .join(" · ")
              : ""}
          </span>
        </div>
        <Show when={digest}>
          {(found) => (
            <DigestBody
              digest={found()}
              itemOf={instanceOf}
              nameOf={nameOf}
              spanName={spanName}
            />
          )}
        </Show>
      </>
    );
  };

  const dayPanel = (day: PlayDay): JSX.Element => {
    const end = nextMidnight(day.start);
    const byName = new Map<string, { runs: number; seconds: number }>();

    for (const span of strip()?.inRange ?? []) {
      const seconds =
        Math.max(
          0,
          Math.min(span.endedAt ?? end, end) -
            Math.max(span.startedAt, day.start),
        ) / 1000;

      if (seconds === 0 || social(span)) {
        continue;
      }

      const held = byName.get(spanName(span)) ?? { runs: 0, seconds: 0 };

      held.runs += 1;
      held.seconds += seconds;
      byName.set(spanName(span), held);
    }

    const drops = shown.digests
      .flatMap(dropsOf)
      .filter((drop) => drop.at >= day.start && drop.at < end).length;

    return (
      <>
        <div class="flex flex-col gap-0.5">
          <span class="text-base font-medium text-foreground">
            {dayTitle(day.day)}
          </span>
          <span class="text-xs text-muted-foreground tabular-nums">
            {[
              `${timeSpan(day.active)} in activities`,
              `${timeSpan(day.social)} social`,
              ...(drops > 0 ? [plural(drops, "drop")] : []),
            ].join(" · ")}
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <For
            each={[...byName]
              .sort((a, b) => b[1].seconds - a[1].seconds)
              .slice(0, DAY_ACTIVITIES)}
          >
            {([name, held]) => (
              <div class="flex justify-between gap-4">
                <span class="truncate">
                  {name}
                  <Show when={held.runs > 1}>
                    <span class="text-muted-foreground"> × {held.runs}</span>
                  </Show>
                </span>
                <span class="shrink-0 text-muted-foreground tabular-nums">
                  {timeSpan(held.seconds)}
                </span>
              </div>
            )}
          </For>
        </div>
      </>
    );
  };

  const markEnter = (key: string, element: HTMLElement) => {
    const found = strip()?.details.get(key);

    if (found) {
      preview(found.item, element, { notes: found.notes });
    }
  };

  const markLeave = (key: string) => {
    const found = strip()?.details.get(key);

    if (found) {
      dismiss(found.item);
    }
  };

  const pick = (key: string) =>
    document
      .getElementById(cardId(key))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  const currency = () => url.get("currency");

  const chartSpansOf = (
    held: { changes: Change[]; from: number; to: number },
    hash: number,
  ): ChartSpan[] => {
    const flows = spanFlowsOf(held.changes, held.from, held.to, hash);

    return spans()
      .filter(
        (span) =>
          span.startedAt <= held.to &&
          (span.endedAt === undefined || span.endedAt >= held.from),
      )
      .map((span) => ({
        key: spanKey(span),
        startedAt: Math.max(span.startedAt, held.from),
        endedAt: Math.min(span.endedAt ?? held.to, held.to),
        name: spanName(span),
        social: social(span),
        earned: flows.get(spanKey(span))?.earned ?? 0,
        spent: flows.get(spanKey(span))?.spent ?? 0,
      }));
  };

  const currencyView = createMemo(() => {
    const hash = currency();
    const held = recorded();

    if (hash === undefined || !held) {
      return undefined;
    }

    return {
      hash,
      balance: balancesOf(held.changes, held.from, held.to).find(
        (balance) => balance.itemHash === hash,
      ),
      ...flowsOf(held.changes, held.from, held.to, hash),
      earnings: earningsOf(held.changes, held.from, held.to, hash, spanLabel),
      spans: chartSpansOf(held, hash),
      timeline: oneDay() ? strip()?.timeline : undefined,
    };
  });

  const mainCurrencies = createMemo((): MainCurrency[] => {
    const held = recorded();
    const balances = held ? balancesOf(held.changes, held.from, held.to) : [];

    return MAIN_CURRENCIES.map((itemHash) => {
      const balance = balances.find((one) => one.itemHash === itemHash);

      return {
        itemHash,
        name: nameOf(itemHash),
        // An emptied currency drops out of the profile
        now:
          held?.observed?.currencies[itemHash] ??
          held?.observed?.stacks[itemHash] ??
          balance?.now ??
          0,
        delta: balance?.delta ?? 0,
        item: fakes()?.get(itemHash),
      };
    });
  });

  const picked = () => url.get("weapon");

  // An empty pick means every weapon
  const pickedWeapon = (instanceId: string): boolean =>
    picked().length === 0 || picked().includes(instanceId);

  const isPicked = (weapon: WeaponKills): boolean =>
    pickedWeapon(weapon.instanceId);

  const togglePick = (weapon: WeaponKills) => {
    const all = shown.weapons.map((one) => one.instanceId);
    const current = picked().length === 0 ? all : picked();
    const next = current.includes(weapon.instanceId)
      ? current.filter((id) => id !== weapon.instanceId)
      : [...current, weapon.instanceId];

    url.replace({
      weapon:
        next.length === all.length ? [] : next.length === 0 ? [NONE] : next,
    });
  };

  const killInterval = () => {
    const timeline = strip()?.timeline;

    return oneDay() && timeline ? intervalFor(timeline.sessions) : undefined;
  };

  const killBars = createMemo(() => {
    const held = recorded();

    if (!held || !url.get("weapons")) {
      return [];
    }

    return killBarsOf(
      held.changes,
      held.from,
      held.to,
      url.get("kills"),
      killInterval() ?? "day",
      pickedWeapon,
    );
  });

  const killActivities = createMemo((): KillSpan[] => {
    const held = recorded();

    if (!held || !url.get("weapons") || !oneDay()) {
      return [];
    }

    const kills = new Map(
      killBarsOf(
        held.changes,
        held.from,
        held.to,
        url.get("kills"),
        "activity",
        pickedWeapon,
      ).map((bar) => [bar.key, bar.total]),
    );

    return (strip()?.inRange ?? []).map((span) => ({
      key: spanKey(span),
      startedAt: Math.max(span.startedAt, held.from),
      endedAt: Math.min(span.endedAt ?? held.to, held.to),
      name: spanName(span),
      social: social(span),
      kills: kills.get(spanKey(span)) ?? 0,
      deaths: deathsOf(span),
    }));
  });

  const barDeaths = (bar: KillBar): number | undefined => {
    if (bar.span) {
      return deathsOf(bar.span);
    }

    const runs = app
      .runs()
      .filter((run) => run.startedAt >= bar.start && run.startedAt < bar.end);

    return runs.length === 0
      ? undefined
      : runs.reduce((total, run) => total + run.deaths, 0);
  };

  const limit = () => url.get("shown") ?? PAGE;

  const empty = () =>
    !!recorded() && shown.weapons.length === 0 && shown.digests.length === 0;

  const pickPeriod = (id: string) => {
    if (id === CHOSEN_DAY) {
      return;
    }

    url.push({
      period: id as (typeof PERIODS)[number]["id"],
      day: undefined,
      shown: undefined,
    });
  };

  return (
    <div class="flex flex-col gap-6 p-4">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Select
          label="Showing"
          value={url.get("day") === undefined ? period().id : CHOSEN_DAY}
          options={PERIODS.map((one): string => one.id)}
          names={PERIOD_NAMES}
          onChange={pickPeriod}
        >
          <Show when={url.get("day")}>
            <option value={CHOSEN_DAY}>{range().label}</option>
          </Show>
        </Select>
        <Show when={url.get("day")}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => url.push({ day: undefined, shown: undefined })}
          >
            Clear day
          </Button>
        </Show>
      </div>

      <Show when={app.loaded() && !own()}>
        <p class="text-muted-foreground">
          Stats are only recorded for your own account.
        </p>
      </Show>

      <Show when={own()}>
        <MainCurrencies
          currencies={mainCurrencies()}
          selected={currency()}
          onPick={(itemHash) =>
            url.push({
              currency: currency() === itemHash ? undefined : itemHash,
              weapons: false,
              weapon: [],
            })
          }
        />
      </Show>

      <Show
        when={currencyView()}
        fallback={
          <Show
            when={url.get("weapons")}
            fallback={
              <>
                <Show when={empty()}>
                  <p class="text-muted-foreground">
                    Nothing recorded in this range. Changes are logged while the
                    app is open.
                  </p>
                </Show>

                <Show when={strip()}>
                  {(found) => (
                    <section class={SECTION}>
                      <h2 class={HEADING}>Play</h2>
                      <Show
                        when={oneDay()}
                        fallback={
                          <DaysStrip
                            days={found().days}
                            panel={dayPanel}
                            onDay={(day) => url.push({ day, shown: undefined })}
                          />
                        }
                      >
                        <DayStrip
                          timeline={found().timeline}
                          blocks={found().blocks}
                          marks={found().marks}
                          panel={blockPanel}
                          onPick={pick}
                          onMarkEnter={markEnter}
                          onMarkLeave={markLeave}
                        />
                      </Show>
                    </section>
                  )}
                </Show>

                <Show when={shown.weapons.length > 0}>
                  <section class={SECTION}>
                    <div class="flex items-center gap-2">
                      <h2 class={HEADING}>Weapon kills</h2>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => url.push({ weapons: true, weapon: [] })}
                      >
                        Graph
                      </Button>
                    </div>
                    <WeaponKillTable
                      weapons={shown.weapons}
                      itemOf={(weapon) =>
                        instanceOf(weapon.instanceId, weapon.itemHash)
                      }
                      nameOf={nameOf}
                      onOpen={(weapon) =>
                        url.push({ weapons: true, weapon: [weapon.instanceId] })
                      }
                    />
                  </section>
                </Show>

                <Show when={shown.digests.length > 0}>
                  <section class={SECTION}>
                    <h2 class={HEADING}>Activities</h2>
                    <ActivityList
                      digests={shown.digests.slice(0, limit())}
                      now={clock()}
                      itemOf={instanceOf}
                      nameOf={nameOf}
                      spanName={spanName}
                      spanHref={spanHref}
                      classOf={classOf}
                      deathsOf={deathsOf}
                      onSelect={(item: DimItem) => app.onPin(item)}
                    />
                    <Show when={shown.digests.length > limit()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        class="self-start"
                        onClick={() => url.push({ shown: limit() + PAGE })}
                      >
                        Show more of {shown.digests.length}
                      </Button>
                    </Show>
                  </section>
                </Show>
              </>
            }
          >
            <WeaponView
              weapons={shown.weapons}
              bars={killBars()}
              interval={killInterval()}
              activities={killActivities()}
              timeline={oneDay() ? strip()?.timeline : undefined}
              mode={url.get("kills")}
              isPicked={isPicked}
              itemOf={(weapon) =>
                instanceOf(weapon.instanceId, weapon.itemHash)
              }
              nameOf={nameOf}
              deathsOf={barDeaths}
              onMode={(kills) => url.replace({ kills })}
              onPick={togglePick}
              onBack={() => url.push({ weapons: false, weapon: [] })}
            />
          </Show>
        }
      >
        {(view) => (
          <CurrencyView
            name={nameOf(view().hash)}
            spans={view().spans}
            timeline={view().timeline}
            item={fakes()?.get(view().hash)}
            balance={view().balance}
            flows={view().flows}
            daily={view().daily}
            earnings={view().earnings}
            onBack={() => url.push({ currency: undefined })}
          />
        )}
      </Show>
    </div>
  );
};
