import type { DimStore } from "app/inventory/store-types";
import { For } from "solid-js";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./lib/zaidan/dropdown-menu.tsx";
import { ChevronDown } from "./lib/zaidan/icons.tsx";

interface Props {
  characters: DimStore[];
  selected: DimStore | undefined;
  onSelect: (store: DimStore) => void;
}

// The art's left square is the emblem icon
const BANNER =
  "flex h-(--banner) items-center gap-2 overflow-hidden rounded-lg bg-cover bg-left pr-3 pl-[calc(var(--banner)+0.5rem)] text-left text-shadow-art";

const art = (url: string | undefined) => ({ "background-image": `url(${url})` });

const Banner = (props: { store: DimStore }) => (
  <div class="min-w-0">
    <div class="truncate font-medium text-foreground">
      {props.store.className}
    </div>
    <div class="truncate text-xs text-foreground/75">
      {props.store.genderRace} · {props.store.powerLevel}
    </div>
  </div>
);

export const CharacterPicker = (props: Props) => (
  <DropdownMenu sameWidth modal={false} preventScroll={false}>
    <DropdownMenuTrigger
      class={`${BANNER} w-full ring-1 ring-foreground/10 hover:ring-foreground/40 aria-expanded:ring-foreground/40`}
      style={art(props.selected?.background)}
    >
      <For each={props.selected ? [props.selected] : []}>
        {(store) => <Banner store={store} />}
      </For>
      <ChevronDown class="ml-auto size-4 shrink-0 text-foreground/75" />
    </DropdownMenuTrigger>
    <DropdownMenuContent class="flex flex-col gap-1">
      <For each={props.characters}>
        {(store) => (
          <DropdownMenuItem
            class={`${BANNER} w-full py-0 focus:ring-2 focus:ring-foreground focus:ring-inset`}
            classList={{ "ring-1 ring-light": store.id === props.selected?.id }}
            style={art(store.background)}
            onSelect={() => props.onSelect(store)}
          >
            <Banner store={store} />
          </DropdownMenuItem>
        )}
      </For>
    </DropdownMenuContent>
  </DropdownMenu>
);
