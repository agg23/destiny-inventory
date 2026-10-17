import { Show } from "solid-js";

import { signOut } from "../../core/api/auth.ts";
import type { Guest } from "../../core/profile/guest.ts";
import { collapseRail, railCollapsed } from "../../core/rail.ts";
import { timeWithSeconds } from "../../core/time.ts";
import { GuestPicker } from "../GuestPicker.tsx";
import { IconButton } from "../lib/IconButton.tsx";
import { PanelGlyph } from "../lib/PanelGlyph.tsx";
import { RefreshGlyph } from "../lib/RefreshGlyph.tsx";
import { SignOutGlyph } from "../lib/SignOutGlyph.tsx";
import { Button } from "../lib/zaidan/button.tsx";
import { Separator } from "../lib/zaidan/separator.tsx";
import { Settings } from "../Settings.tsx";

interface Props {
  stale: boolean;
  spinning: boolean;
  disabled: boolean;
  refreshedAt: number | undefined;
  railed: boolean;
  onRefresh: () => void;
  onGuest: (who: Guest) => void;
}

export const HeaderActions = (props: Props) => {
  const refreshLabel = () => {
    const at = props.refreshedAt;

    return at === undefined
      ? "Refresh"
      : `Refresh · last at ${timeWithSeconds(at)}`;
  };

  const panelLabel = () =>
    railCollapsed() ? "Show side panel" : "Hide side panel";

  return (
      <div class="flex shrink-0 items-center gap-1 text-muted-foreground">
        <Show when={props.stale}>
          <Button
            size="sm"
            variant="outline"
            class="mr-2"
            onClick={() => globalThis.location.reload()}
          >
            New manifest - reload
          </Button>
        </Show>
        <IconButton
          size="icon-sm"
          classList={{ "[&_svg]:animate-spin": props.spinning }}
          label={refreshLabel()}
          disabled={props.disabled}
          onClick={() => props.onRefresh()}
        >
          <RefreshGlyph />
        </IconButton>
        <Show when={props.railed}>
          <IconButton
            size="icon-sm"
            label={panelLabel()}
            onClick={() => collapseRail(!railCollapsed())}
          >
            <PanelGlyph slashed={!railCollapsed()} />
          </IconButton>
        </Show>
        <GuestPicker onChoose={props.onGuest} />
        <Settings />
        <Separator orientation="vertical" class="mx-1 h-4" />
        <IconButton
          size="icon-sm"
          label="Sign out"
          onClick={() => {
            signOut();
            globalThis.location.reload();
          }}
        >
          <SignOutGlyph />
        </IconButton>
      </div>
  );
};
