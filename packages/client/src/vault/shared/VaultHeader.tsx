import type { DimStore } from "app/inventory/store-types";
import { Show } from "solid-js";

import { Checkbox } from "../../components/lib/Checkbox.tsx";
import { Select } from "../../components/lib/Select.tsx";
import { Separator } from "../../components/lib/zaidan/separator.tsx";
import { vaultable } from "../../core/profile/moveTargets.ts";
import {
  applySettings,
  savedSettings,
  settings,
  VAULT_SORT_NAMES,
  VAULT_SORTS,
  type VaultSort,
} from "../../core/settings.ts";

export const VaultHeader = (props: {
  store: DimStore;
  capacity: number;
  character: DimStore | undefined;
}) => (
  <div class="flex h-(--banner) items-center gap-3 rounded-lg border bg-card px-3">
    <img class="size-8 shrink-0" src={props.store.icon} alt="" />
    <div class="min-w-0">
      <div class="truncate font-medium">Vault</div>
      <div class="truncate text-xs text-muted-foreground">
        {props.store.items.filter(vaultable).length}/{props.capacity} items
      </div>
    </div>
    <div class="ml-auto flex shrink-0 items-center gap-3">
      <Show when={props.character}>
        {(character) => (
          <>
            <Checkbox
              class="text-muted-foreground"
              checked={settings().hideOtherClasses}
              onChange={(hideOtherClasses) =>
                applySettings({ ...savedSettings(), hideOtherClasses })
              }
            >
              {character().className} only
            </Checkbox>
            <Separator orientation="vertical" class="mx-1 my-auto h-6" />
          </>
        )}
      </Show>
      <Select
        label="Sort"
        size="sm"
        value={settings().sort}
        options={VAULT_SORTS}
        names={VAULT_SORT_NAMES}
        onChange={(sort: VaultSort) =>
          applySettings({ ...savedSettings(), sort })
        }
      />
    </div>
  </div>
);
