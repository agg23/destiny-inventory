import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
import { createEffect, onCleanup, onMount } from "solid-js";

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type ChartOption = echarts.ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;

interface Props {
  option: ChartOption;
  height: number;
  onPick?: (index: number) => void;
}

export const Chart = (props: Props) => {
  let host: HTMLDivElement | undefined = undefined;
  let chart: echarts.ECharts | undefined = undefined;

  onMount(() => {
    if (!host) {
      return;
    }

    chart = echarts.init(host);
    chart.on("click", (event) => props.onPick?.(event.dataIndex));

    const observer = new ResizeObserver(() => chart?.resize());
    observer.observe(host);

    onCleanup(() => {
      observer.disconnect();
      chart?.dispose();
      chart = undefined;
    });
  });

  createEffect(() => {
    chart?.setOption(props.option, true);
  });

  return (
    <div
      ref={(el) => (host = el)}
      style={{ width: "100%", height: `${props.height}px` }}
    />
  );
};
