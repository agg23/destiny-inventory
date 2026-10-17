import { GuestGlyph } from "../lib/GuestGlyph.tsx";
import { Button } from "../lib/zaidan/button.tsx";

export const GuestBanner = (props: { name: string; onLeave: () => void }) => (
  <div class="flex h-10 items-center gap-3 border-b border-warning/40 bg-warning/15 px-4 text-warning">
    <span class="size-4.5">
      <GuestGlyph />
    </span>
    <span class="font-medium">{props.name}</span>
    <span class="mr-auto text-warning/70">Read only</span>
    <Button
      size="sm"
      variant="outline"
      class="border-warning/40 text-warning hover:bg-warning/15 hover:text-warning"
      onClick={props.onLeave}
    >
      Leave
    </Button>
  </div>
);
