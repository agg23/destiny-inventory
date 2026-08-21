import { createMemo, lazy } from "solid-js";

import type { ChartOption } from "../Chart.tsx";
import { chartColors } from "../chartColors.ts";
import { duration, type HistoryRun } from "../history.ts";
import { shortDay, stamp } from "./runFormat.ts";

// echarts is a third of the bundle
const Chart = lazy(() =>
  import("../Chart.tsx").then((module) => ({ default: module.Chart })),
);

const GRAPH_HEIGHT = 220;

export interface Metric {
  id: string;
  label: string;
  of: (run: HistoryRun) => number;
  format: (value: number) => string;
}

export const DURATION: Metric = {
  id: "duration",
  label: "Duration",
  of: (run) => run.durationSeconds,
  format: (value) => duration(value),
};

export const METRICS: Metric[] = [
  DURATION,
  {
    id: "kills",
    label: "Kills",
    of: (run) => run.kills,
    format: (value) => String(Math.round(value)),
  },
  {
    id: "deaths",
    label: "Deaths",
    of: (run) => run.deaths,
    format: (value) => String(Math.round(value)),
  },
  {
    id: "efficiency",
    label: "Kills per minute",
    of: (run) =>
      run.durationSeconds > 0 ? (run.kills / run.durationSeconds) * 60 : 0,
    format: (value) => value.toFixed(1),
  },
  {
    id: "score",
    label: "Score",
    of: (run) => run.score,
    format: (value) => Math.round(value).toLocaleString(),
  },
];

export const RunGraph = (props: {
  runs: HistoryRun[];
  metric: Metric;
  opened: string | undefined;
  onPick: (run: HistoryRun) => void;
}) => {
  const option = createMemo((): ChartOption => {
    const colors = chartColors();
    const metric = props.metric;

    return {
      animation: false,
      grid: { left: 68, right: 20, top: 16, bottom: 30 },
      tooltip: {
        trigger: "item",
        backgroundColor: colors.surface,
        borderColor: colors.line,
        textStyle: { color: colors.text, fontSize: 12 },
        formatter: (params: unknown) => {
          const run = props.runs[(params as { dataIndex: number }).dataIndex];

          return run
            ? `${stamp(run.startedAt)}<br/>${metric.format(metric.of(run))}`
            : "";
        },
      },
      xAxis: {
        type: "category",
        data: props.runs.map((run) => shortDay(run.startedAt)),
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false },
        axisLabel: { color: colors.dim, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: {
          color: colors.dim,
          fontSize: 11,
          formatter: (value: number) => metric.format(value),
        },
        splitLine: { lineStyle: { color: colors.line, opacity: 0.4 } },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 34,
          data: props.runs.map((run) => metric.of(run)),
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              const run = props.runs[params.dataIndex];

              if (run?.instanceId === props.opened) {
                return colors.good;
              }

              return run?.completed ? colors.accent : colors.surface;
            },
          },
        },
      ],
    };
  });

  return (
    <Chart
      option={option()}
      height={GRAPH_HEIGHT}
      onPick={(index) => {
        const run = props.runs[index];

        if (run) {
          props.onPick(run);
        }
      }}
    />
  );
};
