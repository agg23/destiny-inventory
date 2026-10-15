export interface ChartColors {
  text: string;
  dim: string;
  line: string;
  accent: string;
  good: string;
  surface: string;
}

let resolved: ChartColors | undefined = undefined;

/** Canvas cannot read a custom property, so the tokens are resolved once up front */
export const chartColors = (): ChartColors => {
  if (!resolved) {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();

    resolved = {
      text: read("--text"),
      dim: read("--dim"),
      line: read("--line"),
      accent: read("--color-exotic"),
      good: read("--color-good"),
      surface: read("--surface-raised"),
    };
  }

  return resolved;
};
