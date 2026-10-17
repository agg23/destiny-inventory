import { Glyph, STROKE } from "./Glyph.tsx";

export const RefreshGlyph = () => (
  <Glyph>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" {...STROKE} />
    <path d="M20 4v5h-5" {...STROKE} />
  </Glyph>
);
