import { Glyph, STROKE } from "./Glyph.tsx";

export const VendorGlyph = (props: { class?: string }) => (
  <Glyph class={props.class}>
    <path
      d="M4 9.5 L 5.5 4.5 H 18.5 L 20 9.5 Z"
      stroke-linejoin="round"
      {...STROKE}
    />
    <path d="M5.5 12 V 19.5 H 18.5 V 12" stroke-linejoin="round" {...STROKE} />
    <path d="M10 19.5 V 15 H 14 V 19.5" stroke-linejoin="round" {...STROKE} />
  </Glyph>
);
