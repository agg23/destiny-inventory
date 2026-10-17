import { Show } from "solid-js";

import { Glyph, STROKE } from "./Glyph.tsx";

export const PanelGlyph = (props: { slashed?: boolean }) => (
  <Glyph>
    <rect x="3.5" y="4.5" width="17" height="15" {...STROKE} />
    <path d="M14.5 4.5 L 14.5 19.5" {...STROKE} />
    <Show when={props.slashed}>
      <path d="M3 21 L 21 3" stroke="var(--bg)" stroke-width="4" />
      <path d="M3 21 L 21 3" {...STROKE} />
    </Show>
  </Glyph>
);
