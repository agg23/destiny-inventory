import { createMemo, For } from "solid-js";

import { localDay, playedSeconds, span, type HistoryRun } from "../history.ts";
import { DAY_MS, dayTitle, plural } from "./runFormat.ts";

const HOUR_SECONDS = 3600;
const YEAR_WEEKS = 53;

const TINTS = [0, 26, 46, 68, 100];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface Week {
  year: number;
  column: number;
  startedAt: number;
  seconds: number;
  runs: number;
}

const tint = (level: number): string =>
  level === 0
    ? "var(--color-surface-raised)"
    : `color-mix(in srgb, var(--color-good) ${TINTS[level]}%, transparent)`;

const shade = (seconds: number): number => {
  if (seconds <= 0) {
    return 0;
  }

  if (seconds < 2 * HOUR_SECONDS) {
    return 1;
  }

  if (seconds < 6 * HOUR_SECONDS) {
    return 2;
  }

  if (seconds < 14 * HOUR_SECONDS) {
    return 3;
  }

  return 4;
};

const buildYears = (byDay: Map<string, HistoryRun[]>) => {
  const weeks = new Map<string, Week>();

  for (const [day, runs] of byDay) {
    const at = new Date(`${day}T12:00:00`);
    const year = at.getFullYear();
    const start = new Date(year, 0, 1).getTime();
    const column = Math.min(
      YEAR_WEEKS - 1,
      Math.floor((at.getTime() - start) / DAY_MS / 7),
    );
    const key = `${year}:${column}`;
    const held = weeks.get(key);

    if (held) {
      held.seconds += playedSeconds(runs);
      held.runs += runs.length;

      continue;
    }

    weeks.set(key, {
      year,
      column,
      startedAt: start + column * 7 * DAY_MS,
      seconds: playedSeconds(runs),
      runs: runs.length,
    });
  }

  const years = [...new Set([...weeks.values()].map((one) => one.year))].sort();
  const first = years[0];
  const last = years[years.length - 1];
  const rows: number[] = [];

  for (let year = first ?? 0; year <= (last ?? 0); year += 1) {
    rows.push(year);
  }

  return { rows, weeks };
};

export const ActivityMap = (props: {
  byDay: Map<string, HistoryRun[]>;
  from: number | undefined;
  to: number | undefined;
  onPick: (week: Week) => void;
}) => {
  const grid = createMemo(() => buildYears(props.byDay));

  const columns = `3rem repeat(${YEAR_WEEKS}, minmax(0, 1fr))`;

  const inWindow = (week: Week | undefined): boolean => {
    if (!week) {
      return false;
    }

    const ends = week.startedAt + 7 * DAY_MS;

    return (
      (props.from === undefined || ends > props.from) &&
      (props.to === undefined || week.startedAt < props.to)
    );
  };

  return (
    <div class="flex flex-col gap-2">
      <div
        class="grid items-end gap-[2px]"
        style={{ "grid-template-columns": columns }}
      >
        <span />
        <For each={MONTHS}>
          {(month, index) => (
            <span
              class="text-sm text-dim"
              style={{
                "grid-column-start":
                  Math.round((index() * YEAR_WEEKS) / 12) + 2,
              }}
            >
              {month}
            </span>
          )}
        </For>
      </div>

      <For each={grid().rows}>
        {(year) => (
          <div
            class="grid items-center gap-[2px]"
            style={{ "grid-template-columns": columns }}
          >
            <span class="text-md tabular-nums text-muted">{year}</span>
            <For each={Array.from({ length: YEAR_WEEKS }, (_, index) => index)}>
              {(column) => {
                const week = () => grid().weeks.get(`${year}:${column}`);

                return (
                  <button
                    type="button"
                    class="aspect-square rounded-[2px]"
                    classList={{ "cursor-pointer": week() !== undefined }}
                    disabled={week() === undefined}
                    style={{
                      "background-color": tint(shade(week()?.seconds ?? 0)),
                      outline: inWindow(week())
                        ? "1px solid var(--color-fg)"
                        : undefined,
                      "outline-offset": "1px",
                    }}
                    title={
                      week()
                        ? `Week of ${dayTitle(
                            localDay(week()?.startedAt ?? 0),
                          )} · ${span(week()?.seconds ?? 0)} · ${plural(
                            week()?.runs ?? 0,
                            "run",
                          )}`
                        : undefined
                    }
                    onClick={() => {
                      const found = week();

                      if (found) {
                        props.onPick(found);
                      }
                    }}
                  />
                );
              }}
            </For>
          </div>
        )}
      </For>

      <div class="flex items-center gap-1 text-sm text-dim">
        <span>Less</span>
        <For each={TINTS}>
          {(_, index) => (
            <span
              class="size-3 rounded-[2px]"
              style={{ "background-color": tint(index()) }}
            />
          )}
        </For>
        <span>More</span>
      </div>
    </div>
  );
};
