import { Glyph, STROKE } from "./Glyph.tsx";

export const MapGlyph = () => (
  <Glyph>
    <path
      d="M3.5 6 L 9 4 L 15 6 L 20.5 4 V 18 L 15 20 L 9 18 L 3.5 20 Z"
      stroke-linejoin="round"
      {...STROKE}
    />
    <path d="M9 4 V 18" {...STROKE} />
    <path d="M15 6 V 20" {...STROKE} />
  </Glyph>
);
