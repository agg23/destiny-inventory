import { Glyph, STROKE } from "./Glyph.tsx";

export const RevertGlyph = () => (
  <Glyph>
    <path d="M4 12a8 8 0 1 0 2.34-5.66" {...STROKE} />
    <path d="M4 4v5h5" {...STROKE} />
  </Glyph>
);
