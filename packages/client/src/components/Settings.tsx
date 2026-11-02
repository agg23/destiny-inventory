import { createSignal } from "solid-js";

import type { LoadResult } from "../core/profile/loadTypes.ts";
import {
  applySettings,
  DEFAULTS,
  previewSettings,
  RATING_DISPLAY_NAMES,
  RATING_DISPLAYS,
  savedSettings,
  settings,
  TILE_MAX,
  TILE_MIN,
} from "../core/settings.ts";
import { CogGlyph } from "./lib/CogGlyph.tsx";
import { IconButton } from "./lib/IconButton.tsx";
import { Select } from "./lib/Select.tsx";
import { Slider } from "./lib/Slider.tsx";
import { Toggle } from "./lib/Toggle.tsx";
import { Button } from "./lib/zaidan/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./lib/zaidan/popover.tsx";
import { PerkPreferences } from "./PerkPreferences.tsx";

export const Settings = (props: { loaded: LoadResult | undefined }) => {
  const [open, setOpen] = createSignal(false);
  const [editingPerks, setEditingPerks] = createSignal(false);

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

  // Click-away keeps the draft
  const onOpenChange = (next: boolean) => {
    if (next) {
      previewSettings(savedSettings());
      setOpen(true);

      return;
    }

    close(!discarding);
  };

  return (
    <>
      <Popover
        open={open()}
        onOpenChange={onOpenChange}
        gutter={6}
        placement="bottom-end"
      >
        <PopoverTrigger
          as={IconButton}
          size="icon-sm"
          class="text-muted-foreground"
          label="Settings"
        >
          <CogGlyph />
        </PopoverTrigger>
        <PopoverContent
          data-menu="settings"
          class="w-80 gap-4 p-4"
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

          <Toggle
            label="Display expansions"
            checked={settings().overlay}
            onChange={(overlay) => previewSettings({ ...settings(), overlay })}
          />

          <Select
            label="Ratings order"
            class="justify-between text-foreground!"
            value={settings().ratings}
            options={RATING_DISPLAYS}
            names={RATING_DISPLAY_NAMES}
            onChange={(ratings) => previewSettings({ ...settings(), ratings })}
          />

          <div class="flex items-center justify-between gap-4">
            Perk preferences
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                close(true);
                setEditingPerks(true);
              }}
            >
              Edit
            </Button>
          </div>

          <div class="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => close(true)}>
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <PerkPreferences
        loaded={props.loaded}
        open={editingPerks()}
        onClose={() => setEditingPerks(false)}
      />
    </>
  );
};
