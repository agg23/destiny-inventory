import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { activityTables } from "../activityTables.ts";
import {
  localDay,
  runsByDay,
  type ActivityRow,
  type HistoryRun,
} from "../history.ts";
import type { Session } from "../load.ts";
import { activityLookup } from "./activityLookup.ts";
import { ActivityMap, type Week } from "./ActivityMap.tsx";
import { ActivityPage } from "./ActivityPage.tsx";
import { ActivitySeries } from "./ActivitySeries.tsx";
import { groupBuckets, groupDays } from "./groups.ts";
import { HistoryToolbar } from "./HistoryToolbar.tsx";
import { spanOf, type Span } from "./range.ts";
import { DAY_MS, dayTitle } from "./runFormat.ts";
import { DURATION, METRICS, type Metric } from "./RunGraph.tsx";
import { RunLog } from "./RunLog.tsx";
import { createReport } from "./RunReport.tsx";
import { bestOf, totalsOf } from "./totals.ts";

interface Props {
  session: Session | undefined;
  runs: HistoryRun[];
  syncing: boolean;
  syncError: string | undefined;
  query: string;
}

type Tab = "recent" | "series" | "map";

type View =
  | { kind: "feed" }
  | {
      kind: "activity";
      label: string;
      hash: number;
      difficulty: string | undefined;
      opened: string | undefined;
    };

const PAGE = 40;

const TABS: { id: Tab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "series", label: "Series" },
  { id: "map", label: "Activity map" },
];

export const History = (props: Props) => {
  const [tables] = createResource(activityTables);
  const [view, setView] = createSignal<View>({ kind: "feed" });
  const [tab, setTab] = createSignal<Tab>("recent");
  const [expanded, setExpanded] = createSignal<string[]>([]);
  const [range, setRange] = createSignal("30d");
  const [pinned, setPinned] = createSignal<Span | undefined>(undefined);
  const [metric, setMetric] = createSignal(DURATION.id);
  const [shown, setShown] = createSignal(PAGE);

  const lookup = createMemo(() => activityLookup(tables()));

  const page = () => {
    const current = view();

    return current.kind === "activity" ? current : undefined;
  };

  const opened = (): HistoryRun | undefined => {
    const id = page()?.opened;

    return id === undefined
      ? undefined
      : props.runs.find((one) => one.instanceId === id);
  };

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !page()) {
        return;
      }

      if (opened()) {
        setView((was) =>
          was.kind === "activity" ? { ...was, opened: undefined } : was,
        );

        return;
      }

      setView({ kind: "feed" });
    };

    globalThis.addEventListener("keydown", onKey);
    onCleanup(() => globalThis.removeEventListener("keydown", onKey));
  });

  const oldest = createMemo(() =>
    props.runs.reduce(
      (earliest, one) => Math.min(earliest, one.startedAt),
      Date.now(),
    ),
  );

  const window = (): Span => spanOf(range(), pinned(), oldest());

  const filtered = createMemo(() => {
    const needle = props.query.trim().toLowerCase();
    const { from, to } = window();
    const labelOf = lookup().labelOf;

    return props.runs
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

    return props.runs
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
    const session = props.session;

    return run && session ? { instanceId: run.instanceId, session } : undefined;
  });

  const chosenMetric = (): Metric =>
    METRICS.find((one) => one.id === metric()) ?? DURATION;

  const totals = createMemo(() => totalsOf(filtered()));
  const days = createMemo(() => groupDays(filtered().slice(0, shown())));
  const series = createMemo(() => groupBuckets(tables(), filtered(), lookup()));
  const best = createMemo(() => bestOf(forActivity()));
  const byDay = createMemo(() => runsByDay(props.runs));

  const hero = () => {
    const current = page();

    return current === undefined
      ? undefined
      : tables()?.activities[current.hash];
  };

  const pin = (from: number, to: number, label: string) => {
    setPinned({ from, to, label });
    setShown(PAGE);
    setTab("recent");
  };

  const pickRange = (id: string) => {
    if (id === "custom") {
      return;
    }

    setPinned(undefined);
    setRange(id);
    setShown(PAGE);
  };

  const pickDay = (day: string) => {
    if (day === "") {
      setPinned(undefined);

      return;
    }

    const from = new Date(`${day}T00:00:00`).getTime();
    pin(from, from + DAY_MS, dayTitle(day));
  };

  const pickWeek = (week: Week) =>
    pin(
      week.startedAt,
      week.startedAt + 7 * DAY_MS,
      `Week of ${dayTitle(localDay(week.startedAt))}`,
    );

  const openRow = (row: ActivityRow) =>
    setView({
      kind: "activity",
      label: row.label,
      hash: row.referenceId,
      difficulty: row.difficulty,
      opened: undefined,
    });

  const openActivity = (run: HistoryRun) =>
    setView({
      kind: "activity",
      label: lookup().labelOf(run),
      hash: run.referenceId,
      difficulty: lookup().rungOf(run),
      opened: run.instanceId,
    });

  const toggleRun = (run: HistoryRun) =>
    setView((was) =>
      was.kind === "activity"
        ? {
            ...was,
            opened: was.opened === run.instanceId ? undefined : run.instanceId,
          }
        : was,
    );

  const toggleSeries = (id: string) =>
    setExpanded((was) =>
      was.includes(id) ? was.filter((one) => one !== id) : [...was, id],
    );

  return (
    <div class="flex flex-col gap-3 px-4 pt-3">
      <Show when={page()}>
        <button
          type="button"
          class="button small ghost self-start"
          onClick={() => setView({ kind: "feed" })}
        >
          &larr; All history
        </button>
      </Show>

      <Show when={props.syncError}>
        {(message) => <p class="m-0 text-danger">{message()}</p>}
      </Show>

      <Show when={view().kind === "feed"}>
        <nav class="nav-tabs sections">
          <For each={TABS}>
            {(one) => (
              <button
                type="button"
                class="nav-tab"
                classList={{ active: tab() === one.id }}
                aria-pressed={tab() === one.id}
                onClick={() => setTab(one.id)}
              >
                {one.label}
              </button>
            )}
          </For>
          <Show when={props.syncing}>
            <span class="ml-auto self-center text-sm text-dim">Syncing…</span>
          </Show>
        </nav>

        <Show when={tab() !== "map"}>
          <HistoryToolbar
            range={range()}
            pinned={pinned() !== undefined}
            spanLabel={window().label}
            totals={totals()}
            onRange={pickRange}
            onDay={pickDay}
            onClear={() => setPinned(undefined)}
          />
        </Show>

        <Show when={tab() === "map"}>
          <div class="card">
            <div class="card-header">
              <span class="card-title">Activity map</span>
              <span class="card-subtitle">
                A week per square, a year per row. Pick one to filter Recent.
              </span>
            </div>
            <div class="card-body">
              <ActivityMap
                byDay={byDay()}
                from={window().from}
                to={window().to}
                onPick={pickWeek}
              />
            </div>
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
            <button
              type="button"
              class="button small ghost self-start"
              onClick={() => setShown(shown() + PAGE)}
            >
              Show more of {filtered().length}
            </button>
          </Show>

          <Show when={filtered().length === 0 && !props.syncing}>
            <p class="m-0 text-muted">Nothing in this range.</p>
          </Show>
        </Show>
      </Show>

      <Show when={page()}>
        {(current) => (
          <ActivityPage
            label={current().label}
            difficulty={current().difficulty}
            typeName={lookup().typeOf(hero())}
            art={hero()?.pgcrImage}
            best={best()}
            oldestFirst={forActivity()}
            newestFirst={newestFirst()}
            metric={chosenMetric()}
            onMetric={setMetric}
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
