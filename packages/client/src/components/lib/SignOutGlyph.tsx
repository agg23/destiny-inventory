import { Glyph, STROKE } from "./Glyph.tsx";

export const SignOutGlyph = () => (
  <Glyph>
    <path d="M14 4.5H5.5v15H14" {...STROKE} />
    <path d="M11 12h9.5" {...STROKE} />
    <path d="M17 8.5 20.5 12 17 15.5" {...STROKE} />
  </Glyph>
);
