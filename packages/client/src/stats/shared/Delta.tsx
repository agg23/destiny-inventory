export const signed = (value: number): string =>
  value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();

export const Delta = (props: { value: number }) => (
  <span
    class="text-xs tabular-nums"
    classList={{
      "text-good": props.value > 0,
      "text-muted-foreground": props.value <= 0,
    }}
  >
    {signed(props.value)}
  </span>
);
