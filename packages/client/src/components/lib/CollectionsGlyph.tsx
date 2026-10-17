import { Glyph, STROKE } from "./Glyph.tsx";

export const CollectionsGlyph = () => (
  <Glyph>
    <rect x="4" y="4" width="6.5" height="6.5" {...STROKE} />
    <rect x="13.5" y="4" width="6.5" height="6.5" {...STROKE} />
    <rect x="4" y="13.5" width="6.5" height="6.5" {...STROKE} />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" {...STROKE} />
  </Glyph>
);
