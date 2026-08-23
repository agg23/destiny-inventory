import { Slider as Kobalte } from "@kobalte/core/slider";
import { Show } from "solid-js";

import { RevertGlyph } from "./RevertGlyph.tsx";

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
  <Kobalte
    class="slider"
    value={[props.value]}
    minValue={props.min}
    maxValue={props.max}
    step={props.step ?? 1}
    onChange={([next]) => props.onChange(next ?? props.value)}
  >
    <div class="slider-head">
      <Kobalte.Label class="section-label">{props.label}</Kobalte.Label>
      <div class="slider-readout">
        <span class="slider-value">
          {props.format ? props.format(props.value) : props.value}
        </span>
        <Show when={props.onReset}>
          <button
            type="button"
            class="slider-reset"
            disabled={!props.modified}
            title={`Reset ${props.label.toLowerCase()} to default`}
            aria-label={`Reset ${props.label.toLowerCase()} to default`}
            onClick={() => props.onReset?.()}
          >
            <RevertGlyph />
          </button>
        </Show>
      </div>
    </div>
    <Kobalte.Track class="slider-track">
      <Kobalte.Fill class="slider-fill" />
      <Kobalte.Thumb class="slider-thumb">
        <Kobalte.Input />
      </Kobalte.Thumb>
    </Kobalte.Track>
  </Kobalte>
);
