import { Glyph, STROKE } from "./Glyph.tsx";

export const ExternalGlyph = () => (
  <Glyph>
    <path d="M10 5.5 H 4.5 V 19.5 H 18.5 V 14" {...STROKE} />
    <path d="M13 4.5 H 19.5 V 11" {...STROKE} />
    <path d="M19.5 4.5 L 11 13" {...STROKE} />
  </Glyph>
);
