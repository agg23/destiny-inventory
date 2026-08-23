import { Popover } from "@kobalte/core/popover";
import { createSignal } from "solid-js";

import {
  applySettings,
  DEFAULTS,
  previewSettings,
  savedSettings,
  settings,
  TILE_MAX,
  TILE_MIN,
} from "./settings.ts";
import { Button } from "./ui/Button.tsx";
import { CogGlyph } from "./ui/CogGlyph.tsx";
import { Slider } from "./ui/Slider.tsx";

export const Settings = () => {
  const [open, setOpen] = createSignal(false);

  let discarding = false;

  const close = (keep: boolean) => {
    if (keep) {
      applySettings(settings());
    } else {
      previewSettings(undefined);
    }

    discarding = false;
    setOpen(false);
  };

  // Dismissing by clicking away keeps the draft; only Cancel and Escape drop it
  const onOpenChange = (next: boolean) => {
    if (next) {
      previewSettings(savedSettings());
      setOpen(true);

      return;
    }

    close(!discarding);
  };

  return (
    <Popover
      open={open()}
      onOpenChange={onOpenChange}
      gutter={6}
      placement="bottom-end"
    >
      <Popover.Trigger
        class="header-action"
        title="Settings"
        aria-label="Settings"
      >
        <CogGlyph />
      </Popover.Trigger>
      <Popover.Portal>
        <div class="settings-scrim" />
        <Popover.Content
          data-menu="settings"
          class="settings-panel"
          onEscapeKeyDown={() => (discarding = true)}
        >
          <Slider
            label="Vault icon size"
            value={settings().tile}
            min={TILE_MIN}
            max={TILE_MAX}
            format={(value) => `${value}px`}
            modified={settings().tile !== DEFAULTS.tile}
            onReset={() =>
              previewSettings({ ...settings(), tile: DEFAULTS.tile })
            }
            onChange={(tile) => previewSettings({ ...settings(), tile })}
          />

          <div class="settings-actions">
            <Button size="xs" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="light" onClick={() => close(true)}>
              Save
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};
