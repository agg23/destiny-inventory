import { Show } from "solid-js";

import { IconButton } from "./IconButton.tsx";
import { RevertGlyph } from "./RevertGlyph.tsx";
import { Slider as Track } from "./zaidan/slider.tsx";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
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
        <IconButton
          size="icon-xs"
          class="text-muted-foreground"
          disabled={!props.modified}
          label={`Reset ${props.label.toLowerCase()} to default`}
          onClick={() => props.onReset?.()}
        >
          <RevertGlyph />
        </IconButton>
      </Show>
    </div>
    <Track
      aria-label={props.label}
      value={[props.value]}
      minValue={props.min}
      maxValue={props.max}
      step={1}
      onChange={([next]: number[]) => props.onChange(next ?? props.value)}
    />
  </div>
);
