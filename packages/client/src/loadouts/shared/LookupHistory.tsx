import { For } from "solid-js";

import { IconButton } from "../../components/lib/IconButton.tsx";
import { HEADING_NOTE, ROW } from "../../components/lib/text.ts";
import { X } from "../../components/lib/zaidan/icons.tsx";
import type { LookedUp } from "./history.ts";
import { classAndSubclass } from "./loadoutFacts.ts";

export const LookupHistory = (props: {
  entries: LookedUp[];
  onOpen: (link: string) => void;
  onForget: (key: string) => void;
}) => (
  <div class="flex max-w-xl flex-col">
    <For each={props.entries}>
      {(entry) => (
        <div class="flex items-center gap-0.5">
          <button
            type="button"
            // The field's border and padding, so the text lines up with it
            class={`${ROW} flex-1 border border-transparent px-2.5`}
            onClick={() => props.onOpen(entry.link)}
          >
            <span class="truncate">{entry.name || "Untitled loadout"}</span>
            <span class={`${HEADING_NOTE} shrink-0`}>
              {classAndSubclass(entry.classType, entry.subclass)}
            </span>
          </button>
          <IconButton
            size="icon-sm"
            class="text-muted-foreground"
            label="Remove"
            onClick={() => props.onForget(entry.key)}
          >
            <X />
          </IconButton>
        </div>
      )}
    </For>
  </div>
);
