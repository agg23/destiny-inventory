import type { DimItem } from "app/inventory/item-types";
import { createMemo, lazy, Show } from "solid-js";

import { BackButton } from "../../components/BackButton.tsx";
import { PickOne } from "../../components/lib/PickOne.tsx";
import { HEADING, SECTION } from "../../components/lib/text.ts";
import { plural } from "../../core/text.ts";
import { MINUTE, shortDay, shortTime } from "../../core/time.ts";
import type { ChartOption } from "../../history/shared/Chart.tsx";
import { chartColors } from "../../history/shared/chartColors.ts";
import { KILL_MODES, type KillMode } from "../../core/url.ts";
import { nextMidnight, type KillBar, type WeaponKills } from "./statData.ts";
import { band } from "./bands.ts";
import type { Timeline } from "./timeline.ts";
import { canvasColor, weaponLinesOf } from "./weaponLines.ts";
import { WeaponKillTable } from "./WeaponKillTable.tsx";

// echarts is a third of the bundle
const Chart = lazy(() =>
  import("../../history/shared/Chart.tsx").then((module) => ({
    default: module.Chart,
  })),
);

const CHART_HEIGHT = 240;

const BREAK_HALF = 0.004;

const WEAPONS_LISTED = 8;

const MODE_NAMES: Record<KillMode, string> = {
  all: "All",
  pve: "PvE",
  pvp: "PvP",
};

/** An activity behind the interval bars, with its own totals for the tooltip */
export interface KillSpan {
  key: string;
  startedAt: number;
  endedAt: number;
  name: string;
  social: boolean;
  kills: number;
  deaths: number | undefined;
}

interface KillPoint {
  start: number;
  end: number;
  bar: KillBar | undefined;
}

export const WeaponView = (props: {
  weapons: WeaponKills[];
  bars: KillBar[];
  interval: number | undefined;
  activities: KillSpan[];
  timeline: Timeline | undefined;
  mode: KillMode;
  isPicked: (weapon: WeaponKills) => boolean;
  itemOf: (weapon: WeaponKills) => DimItem | undefined;
  nameOf: (hash: number) => string;
  deathsOf: (bar: KillBar) => number | undefined;
  onMode: (mode: KillMode) => void;
  onPick: (weapon: WeaponKills) => void;
  onBack: () => void;
}) => {
  // Every interval in each session, or every day, zero filled, undefined at an offline break
  const points = createMemo((): (KillPoint | undefined)[] => {
    const byStart = new Map(props.bars.map((bar) => [bar.start, bar]));
    const timeline = props.timeline;
    const size = props.interval;
    const filled: (KillPoint | undefined)[] = [];

    if (timeline && size !== undefined) {
      for (const [index, session] of timeline.sessions.entries()) {
        if (index > 0) {
          filled.push(undefined);
        }

        for (
          let at = Math.floor(session.from / size) * size;
          at < session.to;
          at += size
        ) {
          filled.push({ start: at, end: at + size, bar: byStart.get(at) });
        }
      }

      return filled;
    }

    const first = props.bars[0];
    const last = props.bars.at(-1);

    if (!first || !last) {
      return [];
    }

    for (let at = first.start; at <= last.start; at = nextMidnight(at)) {
      filled.push({ start: at, end: nextMidnight(at), bar: byStart.get(at) });
    }

    return filled;
  });

  // Picked weapons with a kill in range, most kills first
  const lines = createMemo(() => {
    const kills = new Map<string, number>();

    for (const bar of props.bars) {
      for (const [instanceId, weapon] of bar.byWeapon) {
        kills.set(instanceId, (kills.get(instanceId) ?? 0) + weapon.kills);
      }
    }

    return weaponLinesOf(
      props.weapons
        .filter((weapon) => (kills.get(weapon.instanceId) ?? 0) > 0)
        .sort(
          (a, b) =>
            (kills.get(b.instanceId) ?? 0) - (kills.get(a.instanceId) ?? 0),
        ),
      props.itemOf,
    );
  });

  const lineOf = (instanceId: string) =>
    lines().find((line) => line.instanceId === instanceId);

  const option = createMemo((): ChartOption => {
    const colors = chartColors();
    const timeline = props.timeline;
    const xOf = (point: KillPoint) =>
      timeline
        ? timeline.toX((point.start + point.end) / 2)
        : (point.start + point.end) / 2;

    return {
      animation: false,
      grid: { left: 48, right: 20, top: 16, bottom: 30 },
      tooltip: {
        trigger: "axis",
        backgroundColor: colors.surface,
        borderColor: colors.line,
        textStyle: { color: colors.text, fontSize: 12 },
        formatter: (params: unknown) => {
          const index = (params as { dataIndex: number }[])[0]?.dataIndex;
          const point = index === undefined ? undefined : points()[index];

          if (!point) {
            return "";
          }

          const total = point.bar?.total ?? 0;
          const top = [...(point.bar?.byWeapon ?? [])]
            .sort((a, b) => b[1].kills - a[1].kills)
            .slice(0, WEAPONS_LISTED)
            .map(([instanceId, weapon]) => {
              const line = lineOf(instanceId);
              const dot = line
                ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${canvasColor(line.color)}"></span>`
                : "";

              return `${dot}${props.nameOf(weapon.itemHash)} ${weapon.kills.toLocaleString()}`;
            });

          if (!timeline) {
            const deaths = point.bar ? props.deathsOf(point.bar) : undefined;

            return [
              `<b>${shortDay(point.start)}</b>`,
              [
                plural(total, "kill"),
                ...(deaths === undefined ? [] : [plural(deaths, "death")]),
              ].join(" · "),
              ...top,
            ].join("<br/>");
          }

          const middle = (point.start + point.end) / 2;
          const during = props.activities.find(
            (one) => one.startedAt <= middle && middle < one.endedAt,
          );

          return [
            `${shortTime(point.start)} - ${shortTime(point.end)} · ${plural(total, "kill")}`,
            ...top,
            ...(during
              ? [
                  "",
                  `<b>${during.name}</b> ${shortTime(during.startedAt)} - ${shortTime(during.endedAt)}`,
                  [
                    plural(during.kills, "kill"),
                    ...(during.deaths === undefined
                      ? []
                      : [plural(during.deaths, "death")]),
                  ].join(" · "),
                ]
              : []),
          ].join("<br/>");
        },
      },
      xAxis: timeline
        ? {
            type: "value",
            min: 0,
            max: 1,
            splitLine: { show: false },
            axisLine: { lineStyle: { color: colors.line } },
            axisTick: { show: false },
            axisLabel: {
              color: colors.dim,
              fontSize: 11,
              hideOverlap: true,
              formatter: (x: number) => shortTime(timeline.toTime(x)),
            },
          }
        : {
            type: "time",
            axisLine: { lineStyle: { color: colors.line } },
            axisTick: { show: false },
            axisLabel: {
              color: colors.dim,
              fontSize: 11,
              hideOverlap: true,
              formatter: (at: number) => shortDay(at),
            },
          },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: { color: colors.dim, fontSize: 11 },
        splitLine: { lineStyle: { color: colors.line, opacity: 0.4 } },
      },
      series: lines().map((line, index) => ({
        type: "line" as const,
        name: props.nameOf(line.itemHash),
        symbol: "none",
        connectNulls: false,
        // A null point breaks the line at an offline gap
        data: points().map((point) =>
          point
            ? [xOf(point), point.bar?.byWeapon.get(line.instanceId)?.kills ?? 0]
            : null,
        ),
        lineStyle: {
          color: canvasColor(line.color),
          width: 1.5,
          type: line.dash,
        },
        emphasis: { focus: "series" as const },
        markArea:
          index === 0 && timeline
            ? {
                silent: true,
                data: [
                  ...props.activities
                    .filter((one) => !one.social)
                    .map((one) =>
                      band(
                        timeline.toX(one.startedAt),
                        timeline.toX(one.endedAt),
                        colors.text,
                        0.08,
                      ),
                    ),
                  ...timeline.breaks.map((gap) =>
                    band(
                      gap.x - BREAK_HALF,
                      gap.x + BREAK_HALF,
                      colors.surface,
                      1,
                    ),
                  ),
                ],
              }
            : undefined,
      })),
    };
  });

  return (
    <div class="flex flex-col gap-6">
      <BackButton onClick={props.onBack}>All stats</BackButton>

      <section class={SECTION}>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 class={HEADING}>
            Kills{" "}
            {props.interval === undefined
              ? "per day"
              : `per ${Math.round(props.interval / MINUTE)} minutes`}
          </h2>
          <PickOne
            value={props.mode}
            options={KILL_MODES}
            label={(mode) => MODE_NAMES[mode]}
            onChange={props.onMode}
          />
        </div>
        <Show
          when={points().length > 0}
          fallback={
            <p class="text-muted-foreground">
              No kills recorded for these weapons in this range.
            </p>
          }
        >
          <Chart option={option()} height={CHART_HEIGHT} />
        </Show>
      </section>

      <section class={SECTION}>
        <h2 class={HEADING}>Weapons</h2>
        <WeaponKillTable
          weapons={props.weapons}
          itemOf={props.itemOf}
          nameOf={props.nameOf}
          isPicked={props.isPicked}
          lineOf={(weapon) => lineOf(weapon.instanceId)}
          onPick={props.onPick}
        />
      </section>
    </div>
  );
};
