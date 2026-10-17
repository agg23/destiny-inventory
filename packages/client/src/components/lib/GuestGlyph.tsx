import { Glyph, STROKE } from "./Glyph.tsx";

export const GuestGlyph = () => (
  <Glyph>
    <circle cx="12" cy="8" r="3.6" {...STROKE} />
    <path
      d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0"
      stroke-linecap="round"
      {...STROKE}
    />
  </Glyph>
);
