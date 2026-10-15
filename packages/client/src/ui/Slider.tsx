import { Show } from "solid-js";

import { RevertGlyph } from "./RevertGlyph.tsx";
import { Button } from "./zaidan/button.tsx";
import { Slider as Track } from "./zaidan/slider.tsx";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  modified?: boolean;
  onReset?: () => void;
  onChange: (value: number) => void;
}

export const Slider = (props: Props) => (
  <div class="flex flex-col gap-3">
    <div class="flex h-6 items-center gap-2">
      <span class="flex-1">{props.label}</span>
      <span class="text-muted-foreground tabular-nums">
        {props.format ? props.format(props.value) : props.value}
      </span>
      <Show when={props.onReset}>
        <Button
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground"
          disabled={!props.modified}
          title={`Reset ${props.label.toLowerCase()} to default`}
          aria-label={`Reset ${props.label.toLowerCase()} to default`}
          onClick={() => props.onReset?.()}
        >
          <RevertGlyph />
        </Button>
      </Show>
    </div>
    <Track
      aria-label={props.label}
      value={[props.value]}
      minValue={props.min}
      maxValue={props.max}
      step={props.step ?? 1}
      onChange={([next]: number[]) => props.onChange(next ?? props.value)}
    />
  </div>
);
