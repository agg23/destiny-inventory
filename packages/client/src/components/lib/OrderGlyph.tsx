import { Glyph, STROKE } from "./Glyph.tsx";

export const OrderGlyph = (props: { class?: string }) => (
  <Glyph class={props.class}>
    <path
      d="M6 3.5 H 14 L 18 7.5 V 20.5 H 6 Z"
      stroke-linejoin="round"
      {...STROKE}
    />
    <path d="M14 3.5 V 7.5 H 18" stroke-linejoin="round" {...STROKE} />
    <path d="M9 12 H 15" {...STROKE} />
    <path d="M9 16 H 13" {...STROKE} />
  </Glyph>
);
