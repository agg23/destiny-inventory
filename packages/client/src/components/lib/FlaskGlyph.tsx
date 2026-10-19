import { Glyph, STROKE } from "./Glyph.tsx";

export const FlaskGlyph = (props: { class?: string }) => (
  <Glyph class={props.class}>
    <path d="M9 3.5 H 15" {...STROKE} />
    <path
      d="M10 3.5 V 9.5 L 4.8 18.4 A 1.4 1.4 0 0 0 6 20.5 H 18 A 1.4 1.4 0 0 0 19.2 18.4 L 14 9.5 V 3.5"
      {...STROKE}
    />
    <path d="M7.5 14.5 H 16.5" {...STROKE} />
  </Glyph>
);
