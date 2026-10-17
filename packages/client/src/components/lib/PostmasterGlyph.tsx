import { Glyph, STROKE } from "./Glyph.tsx";

export const PostmasterGlyph = (props: { class?: string }) => (
  <Glyph class={props.class}>
    <path
      d="M4 13 L 6.5 5 H 17.5 L 20 13 V 19 H 4 Z"
      stroke-linejoin="round"
      {...STROKE}
    />
    <path
      d="M4 13 H 8.5 L 10 15.5 H 14 L 15.5 13 H 20"
      stroke-linejoin="round"
      {...STROKE}
    />
  </Glyph>
);
