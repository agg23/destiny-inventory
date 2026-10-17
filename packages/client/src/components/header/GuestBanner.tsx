import { GuestGlyph } from "../lib/GuestGlyph.tsx";
import { WarningBanner } from "../WarningBanner.tsx";

export const GuestBanner = (props: { name: string; onLeave: () => void }) => (
  <WarningBanner
    glyph={<GuestGlyph />}
    title={props.name}
    note="Read only"
    action="Leave"
    onAction={props.onLeave}
  />
);
