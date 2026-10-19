interface BandEdge {
  xAxis: number;
  itemStyle: { color: string; opacity: number };
}

/** A shaded stretch of a chart's x axis, as echarts markArea takes it */
export const band = (
  from: number,
  to: number,
  color: string,
  opacity: number,
): [BandEdge, BandEdge] => [
  { xAxis: from, itemStyle: { color, opacity } },
  { xAxis: to, itemStyle: { color, opacity } },
];
