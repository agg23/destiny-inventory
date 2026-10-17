import { useNavigate, useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";

import { PickOne } from "../components/lib/PickOne.tsx";
import { CARD } from "../components/lib/text.ts";
import { Button } from "../components/lib/zaidan/button.tsx";
import { activityTables } from "../core/activities/activityTables.ts";
import { activityArt } from "../core/activities/art.ts";
import {
  localDay,
  runsByDay,
  type ActivityRow,
  type HistoryRun,
} from "../core/activities/history.ts";
import { useApp } from "../core/app/state.ts";
import { useUrl } from "../core/router.ts";
import {
  activityHref,
  activityLabel,
  runHref,
  tabHref,
  type HistoryTab,
} from "../core/url.ts";
import { activityLookup } from "./shared/activityLookup.ts";
import { ActivityMap, type Week } from "./shared/ActivityMap.tsx";
import { ActivityPage } from "./shared/ActivityPage.tsx";
import { ActivitySeries } from "./shared/ActivitySeries.tsx";
import { groupBuckets, groupDays } from "./shared/groups.ts";
import { HistoryRange, HistorySummary } from "./shared/HistoryToolbar.tsx";
import { pinnedSpan, spanOf, type Span } from "./shared/range.ts";
import { DURATION, METRICS, type Metric } from "./shared/RunGraph.tsx";
import { RunLog } from "./shared/RunLog.tsx";
import { createReport } from "./shared/RunReport.tsx";
import { bestOf, totalsOf } from "./shared/totals.ts";

const PAGE = 40;

const TABS: { id: HistoryTab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "series", label: "Series" },
  { id: "map", label: "Activity map" },
];

export const History = () => {
  const app = useApp();
  const url = useUrl();
  const route = useParams<{ label?: string }>();
  const navigate = useNavigate();
  const [tables] = createResource(activityTables, {
    initialValue: activityTables.settled(),
  });
  const tab = () => url.get("view");
  const expanded = () => url.get("open");
  const range = () => url.get("range");
  const pinned = () => pinnedSpan(url.get("from"), url.get("days"));
  const metric = () => url.get("metric") ?? DURATION.id;
  const shown = () => url.get("shown") ?? PAGE;

  const lookup = createMemo(() => activityLookup(tables()));

  const page = () => {
    const label = activityLabel(route.label);

    return label === undefined
      ? undefined
      : { label, difficulty: url.get("rung") };
  };

  const opened = (): HistoryRun | undefined => {
    const id = url.get("run");

    return id === undefined
      ? undefined
      : app.runs().find((one) => one.instanceId === id);
  };

  const leave = () => navigate(tabHref("history"));

  // The sync may not have reached these runs yet
  const empty = () => page() !== undefined && forActivity().length === 0;

  const awaiting = () => empty() && (app.syncing() || tables.loading);

  const oldest = createMemo(() =>
    app
      .runs()
      .reduce((earliest, one) => Math.min(earliest, one.startedAt), Date.now()),
  );

  const window = (): Span => spanOf(range(), pinned(), oldest());

  const filtered = createMemo(() => {
    const needle = app.query().trim().toLowerCase();
    const { from, to } = window();
    const labelOf = lookup().labelOf;

    return app
      .runs()
      .filter((one) => {
        if (from !== undefined && one.startedAt < from) {
          return false;
        }

        if (to !== undefined && one.startedAt >= to) {
          return false;
        }

        return needle === "" || labelOf(one).toLowerCase().includes(needle);
      })
      .sort((a, b) => b.startedAt - a.startedAt);
  });

  const forActivity = createMemo(() => {
    const current = page();

    if (!current) {
      return [];
    }

    const { labelOf, rungOf } = lookup();

    return app
      .runs()
      .filter(
        (one) =>
          labelOf(one) === current.label && rungOf(one) === current.difficulty,
      )
      .sort((a, b) => a.startedAt - b.startedAt);
  });

  const newestFirst = createMemo(() =>
    [...forActivity()].sort((a, b) => b.startedAt - a.startedAt),
  );

  const [report] = createReport(() => {
    const run = opened();
    const session = app.loaded()?.session;

    return run && session ? { instanceId: run.instanceId, session } : undefined;
  });

  const chosenMetric = (): Metric =>
    METRICS.find((one) => one.id === metric()) ?? DURATION;

  const totals = createMemo(() => totalsOf(filtered()));
  const days = createMemo(() => groupDays(filtered().slice(0, shown())));
  const series = createMemo(() => groupBuckets(tables(), filtered(), lookup()));
  const best = createMemo(() => bestOf(forActivity()));
  const byDay = createMemo(() => runsByDay(app.runs()));

  const hero = () => {
    const hash = newestFirst()[0]?.referenceId;

    return hash === undefined ? undefined : tables()?.activities[hash];
  };

  const pickRange = (id: string) => {
    if (id === "custom") {
      return;
    }

    url.push({ range: id, from: undefined, days: undefined, shown: undefined });
  };

  const pickDay = (day: string) => {
    if (day === "") {
      url.push({ from: undefined, days: undefined });

      return;
    }

    url.push({ from: day, days: 1, shown: undefined, view: "recent" });
  };

  const pickWeek = (week: Week) =>
    url.push({
      from: localDay(week.startedAt),
      days: 7,
      shown: undefined,
      view: "recent",
    });

  const openRow = (row: ActivityRow) =>
    navigate(activityHref(row.label, row.difficulty));

  const openActivity = (run: HistoryRun) =>
    navigate(
      runHref(lookup().labelOf(run), lookup().rungOf(run), run.instanceId),
    );

  const toggleRun = (run: HistoryRun) =>
    url.push({
      run: url.get("run") === run.instanceId ? undefined : run.instanceId,
    });

  const toggleSeries = (id: string) =>
    url.push({
      open: expanded().includes(id)
        ? expanded().filter((one) => one !== id)
        : [...expanded(), id],
    });

  return (
    <div class="flex flex-col gap-3 p-4">
      <Show when={page()}>
        <Button size="sm" variant="ghost" class="self-start" onClick={leave}>
          &larr; All history
        </Button>
      </Show>

      <Show when={page() === undefined}>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PickOne
            value={tab()}
            options={TABS.map((one) => one.id)}
            label={(id) => TABS.find((one) => one.id === id)?.label}
            onChange={(view) => url.push({ view })}
          />

          <Show when={tab() !== "map"}>
            <HistoryRange
              range={range()}
              pinned={pinned() !== undefined}
              onRange={pickRange}
              onDay={pickDay}
              onClear={() => url.push({ from: undefined, days: undefined })}
            />
            <span class="ml-auto">
              <HistorySummary spanLabel={window().label} totals={totals()} />
            </span>
          </Show>
        </div>

        <Show when={tab() === "map"}>
          <div class={CARD}>
            <div class="flex flex-col gap-0.5">
              <span class="font-medium">Activity map</span>
              <span class="text-xs text-muted-foreground">
                A week per square, a year per row. Pick one to filter Recent.
              </span>
            </div>
            <ActivityMap
              byDay={byDay()}
              from={window().from}
              to={window().to}
              onPick={pickWeek}
            />
          </div>
        </Show>

        <Show when={tab() === "series"}>
          <ActivitySeries
            groups={series()}
            plateOf={lookup().rowPlate}
            isExpanded={(id) => expanded().includes(id)}
            onToggle={toggleSeries}
            onOpen={openRow}
          />
        </Show>

        <Show when={tab() === "recent"}>
          <RunLog
            days={days()}
            plateOf={lookup().runPlate}
            onOpen={openActivity}
          />

          <Show when={filtered().length > shown()}>
            <Button
              size="sm"
              variant="ghost"
              class="self-start"
              onClick={() => url.push({ shown: shown() + PAGE })}
            >
              Show more of {filtered().length}
            </Button>
          </Show>

          <Show when={filtered().length === 0 && !app.syncing()}>
            <p class="text-muted-foreground">Nothing in this range.</p>
          </Show>
        </Show>
      </Show>

      <Show when={awaiting()}>
        <p class="text-muted-foreground">Loading</p>
      </Show>

      <Show when={empty() && !awaiting()}>
        <p class="text-muted-foreground">No runs of this activity.</p>
      </Show>

      <Show when={empty() ? undefined : page()}>
        {(current) => (
          <ActivityPage
            label={current().label}
            difficulty={current().difficulty}
            typeName={lookup().typeOf(hero())}
            art={(() => {
              const found = hero();
              const held = tables();

              return found && held ? activityArt(found, held) : undefined;
            })()}
            best={best()}
            oldestFirst={forActivity()}
            newestFirst={newestFirst()}
            metric={chosenMetric()}
            onMetric={(id) => url.push({ metric: id })}
            opened={opened()}
            onPick={toggleRun}
            report={report()}
            reportLoading={report.loading}
            reportFailed={!!report.error}
            tables={tables()}
          />
        )}
      </Show>
    </div>
  );
};
