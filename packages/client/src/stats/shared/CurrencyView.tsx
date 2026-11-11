import type { DimItem } from "app/inventory/item-types";
import { createMemo, For, lazy, Show } from "solid-js";

import { BackButton } from "../../components/BackButton.tsx";
import {
  HEADING,
  SECTION,
  TABLE_FRAME,
  TABLE_HEADER,
} from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { NUMBER, NumCell } from "../../components/NumCell.tsx";
import {
  DAY,
  dateTime,
  HOUR,
  shortDay,
  shortTime,
  span,
} from "../../core/time.ts";
import type { ChartOption } from "../../history/shared/Chart.tsx";
import { chartColors } from "../../history/shared/chartColors.ts";
import { Delta } from "./Delta.tsx";
import { CurrencyIcon } from "./MainCurrencies.tsx";
import type { Balance, Earning, Flow, Level, LevelMark } from "./statData.ts";
import { band } from "./bands.ts";
import type { Timeline } from "./timeline.ts";

// echarts is a third of the bundle
const Chart = lazy(() =>
  import("../../history/shared/Chart.tsx").then((module) => ({
    default: module.Chart,
  })),
);

const CHART_HEIGHT = 240;

const BREAK_HALF = 0.004;

// Fraction of the x axis
const LABEL_GAP = 0.012;

// Per hour is noise under a minute
const RATE_FLOOR = 60;

const perHour = (row: Earning): number | undefined =>
  row.seconds < RATE_FLOOR ? undefined : row.earned / (row.seconds / 3600);

export interface ChartSpan {
  key: string;
  startedAt: number;
  endedAt: number;
  name: string;
  social: boolean;
  earned: number;
  spent: number;
}

export const CurrencyView = (props: {
  name: string;
  spans: ChartSpan[];
  timeline: Timeline | undefined;
  item: DimItem | undefined;
  icon: string | undefined;
  balance: Pick<Balance, "now" | "delta" | "points"> | undefined;
  spending: boolean;
  level: Level | undefined;
  marks: LevelMark[];
  flows: Flow[];
  daily: boolean;
  earnings: Earning[];
  onBack: () => void;
}) => {
  const lineName = () => (props.spending ? "Balance" : "Total");

  const option = createMemo((): ChartOption => {
    const colors = chartColors();
    const flows = props.flows;
    const points = props.balance?.points ?? [];
    const size = props.daily ? DAY : HOUR;
    const timeline = props.timeline;
    const place = (at: number) => (timeline ? timeline.toX(at) : at);
    const timeAt = (x: number) => (timeline ? timeline.toTime(x) : x);

    const flowAt = (at: number) =>
      flows.find((flow) => flow.start <= at && at < flow.start + size);
    const balanceAt = (at: number) =>
      points.filter(([when]) => when <= at).at(-1)?.[1];
    const spanAt = (at: number) =>
      props.spans.find((one) => one.startedAt <= at && at < one.endedAt);
    const offlineAt = (at: number) =>
      timeline?.breaks.find((gap) => gap.from < at && at < gap.to);

    // One bar per activity on a single day, per bucket past that
    // One day shows the balance line alone
    const bars = timeline
      ? []
      : flows.map((flow) => ({
          x: flow.start + size / 2,
          earned: props.spending ? flow.earned : flow.earned - flow.spent,
          spent: props.spending ? flow.spent : 0,
        }));

    const flowLine = (earned: number, spent: number) =>
      props.spending
        ? `earned ${earned.toLocaleString()}, spent ${spent.toLocaleString()}`
        : `earned ${(earned - spent).toLocaleString()}`;

    const label = (at: number) => (props.daily ? shortDay(at) : shortTime(at));

    const axisMin = timeline ? 0 : (flows[0]?.start ?? 0);
    const axisMax = timeline ? 1 : (flows.at(-1)?.start ?? 0) + size;
    const clusters: { first: number; marks: LevelMark[] }[] = [];

    for (const mark of props.marks) {
      const last = clusters.at(-1);
      const previous = last?.marks.at(-1);

      if (
        last &&
        previous &&
        place(mark.at) - place(previous.at) < LABEL_GAP * (axisMax - axisMin)
      ) {
        last.marks.push(mark);
      } else {
        clusters.push({ first: mark.first, marks: [mark] });
      }
    }

    const markLines = clusters.flatMap(({ first, marks }) =>
      marks.map((mark, index) => {
        if (index < marks.length - 1) {
          return { xAxis: place(mark.at), label: { show: false } };
        }

        return {
          xAxis: place(mark.at),
          label: {
            formatter:
              first === mark.level
                ? `Level ${mark.level}`
                : `Level ${first}-${mark.level}`,
          },
        };
      }),
    );

    return {
      animation: false,
      grid: { left: 64, right: timeline ? 20 : 64, top: 16, bottom: 30 },
      tooltip: {
        trigger: "axis",
        backgroundColor: colors.surface,
        borderColor: colors.line,
        textStyle: { color: colors.text, fontSize: 12 },
        formatter: (params: unknown) => {
          const x = (params as { axisValue: number }[])[0]?.axisValue;

          if (x === undefined) {
            return "";
          }

          const at = timeAt(x);
          const gap = offlineAt(at);

          if (gap) {
            return `Offline ${span((gap.to - gap.from) / 1000)} · ${shortTime(gap.from)} - ${shortTime(gap.to)}`;
          }

          const during = spanAt(at);
          const lines = [
            `${props.daily ? shortDay(at) : dateTime(at)} · ${lineName()} ${balanceAt(at)?.toLocaleString() ?? "-"}`,
          ];

          if (!timeline) {
            const flow = flowAt(at);

            lines.push(
              `${props.daily ? "That day" : "That hour"}: ${flowLine(flow?.earned ?? 0, flow?.spent ?? 0)}`,
            );
          }

          if (during) {
            lines.unshift(
              `<b>${during.name}</b> ${shortTime(during.startedAt)} - ${shortTime(during.endedAt)}`,
              props.spending
                ? `Earned ${during.earned.toLocaleString()}, spent ${during.spent.toLocaleString()}`
                : `Earned ${(during.earned - during.spent).toLocaleString()}`,
            );
          }

          return lines.join("<br/>");
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
            min: axisMin,
            max: axisMax,
            axisLine: { lineStyle: { color: colors.line } },
            axisTick: { show: false },
            axisLabel: {
              color: colors.dim,
              fontSize: 11,
              hideOverlap: true,
              formatter: label,
            },
          },
      yAxis: [
        ...(timeline
          ? []
          : [
              {
                type: "value" as const,
                axisLabel: {
                  color: colors.dim,
                  fontSize: 11,
                  formatter: (value: number) => value.toLocaleString(),
                },
                splitLine: { lineStyle: { color: colors.line, opacity: 0.4 } },
              },
            ]),
        {
          type: "value",
          scale: true,
          axisLabel: {
            color: colors.dim,
            fontSize: 11,
            formatter: (value: number) => value.toLocaleString(),
          },
          splitLine: {
            show: !!timeline,
            lineStyle: { color: colors.line, opacity: 0.4 },
          },
        },
      ],
      series: [
        {
          type: "bar",
          name: "Earned",
          stack: "flow",
          barMaxWidth: 24,
          data: bars.map((bar) => [bar.x, bar.earned]),
          itemStyle: { color: colors.good },
        },
        ...(props.spending
          ? [
              {
                type: "bar" as const,
                name: "Spent",
                stack: "flow",
                barMaxWidth: 24,
                data: bars.map((bar) => [bar.x, -bar.spent]),
                itemStyle: { color: colors.dim },
              },
            ]
          : []),
        {
          type: "line",
          name: lineName(),
          yAxisIndex: timeline ? 0 : 1,
          step: "end",
          symbol: "none",
          data: points.map(([at, value]) => [place(at), value]),
          lineStyle: { color: colors.text, width: 1.5 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: colors.dim, type: "dashed", width: 1 },
            label: {
              position: "insideEndTop",
              color: colors.text,
              fontSize: 11,
              textBorderColor: colors.background,
              textBorderWidth: 2,
            },
            data: markLines,
          },
          markArea: {
            silent: true,
            data: [
              ...props.spans
                .filter((one) => !one.social)
                .map((one) =>
                  band(
                    place(one.startedAt),
                    place(one.endedAt),
                    colors.text,
                    0.08,
                  ),
                ),
              // A collapsed offline gap reads as a cut in the chart
              ...(timeline?.breaks ?? []).map((gap) =>
                band(gap.x - BREAK_HALF, gap.x + BREAK_HALF, colors.surface, 1),
              ),
            ],
          },
        },
      ],
    };
  });

  const ranked = createMemo(() =>
    [...props.earnings].sort(
      (a, b) => (perHour(b) ?? -1) - (perHour(a) ?? -1) || b.earned - a.earned,
    ),
  );

  return (
    <div class="flex flex-col gap-6">
      <BackButton onClick={props.onBack}>All stats</BackButton>

      <div class="flex items-center gap-3">
        <span class="size-10 shrink-0">
          <CurrencyIcon
            name={props.name}
            item={props.item}
            icon={props.icon}
            class="nested size-10"
          />
        </span>
        <span class="flex flex-col">
          <span class="text-lg font-medium">{props.name}</span>
          <Show when={props.balance}>
            {(balance) => (
              <span class="flex items-baseline gap-2 tabular-nums">
                <span>{balance().now.toLocaleString()}</span>
                <Show when={props.spending}>
                  <Delta value={balance().delta} />
                </Show>
                <Show when={props.level}>
                  {(level) => (
                    <span class="text-xs text-muted-foreground">
                      Level {level().level.toLocaleString()} (
                      {level().progress.toLocaleString()})
                    </span>
                  )}
                </Show>
              </span>
            )}
          </Show>
        </span>
      </div>

      <Show
        when={props.flows.length > 0}
        fallback={
          <p class="text-muted-foreground">
            No {props.name} changes recorded in this range.
          </p>
        }
      >
        <section class={SECTION}>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 class={HEADING}>
              {props.timeline
                ? lineName()
                : `${props.spending ? "Earned and spent" : "Earned"} ${props.daily ? "per day" : "per hour"}`}
            </h2>
            <Show when={!props.timeline}>
              <span class="flex items-center gap-3 text-xs text-muted-foreground">
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2.5 rounded-sm bg-good" />
                  Earned
                </span>
                <Show when={props.spending}>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="size-2.5 rounded-sm bg-(--dim)" />
                    Spent
                  </span>
                </Show>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-0.5 w-3 bg-(--text)" />
                  {lineName()}
                </span>
              </span>
            </Show>
          </div>
          <Chart option={option()} height={CHART_HEIGHT} />
        </section>
      </Show>

      <Show when={ranked().length > 0}>
        <section class={SECTION}>
          <h2 class={HEADING}>By activity</h2>
          <div class={TABLE_FRAME}>
            <Table>
              <TableHeader class={TABLE_HEADER}>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead class={NUMBER}>Runs</TableHead>
                  <TableHead class={NUMBER}>Time</TableHead>
                  <TableHead class={NUMBER}>Earned</TableHead>
                  <TableHead class={NUMBER}>Per run</TableHead>
                  <TableHead class={NUMBER}>Per hour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={ranked()}>
                  {(row) => (
                    <TableRow>
                      <TableCell>{row.label}</TableCell>
                      <NumCell>{row.runs}</NumCell>
                      <NumCell>{span(row.seconds)}</NumCell>
                      <NumCell>{row.earned.toLocaleString()}</NumCell>
                      <NumCell>
                        {Math.round(
                          row.earned / Math.max(1, row.runs),
                        ).toLocaleString()}
                      </NumCell>
                      <NumCell class="font-medium">
                        {perHour(row) === undefined
                          ? "-"
                          : Math.round(perHour(row)!).toLocaleString()}
                      </NumCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
          </div>
        </section>
      </Show>
    </div>
  );
};
