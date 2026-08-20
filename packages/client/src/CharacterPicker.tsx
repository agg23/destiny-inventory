import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import type { DimStore } from "app/inventory/store-types";
import { For } from "solid-js";

interface Props {
  characters: DimStore[];
  selected: DimStore | undefined;
  onSelect: (store: DimStore) => void;
}

// The framework's card, plus the emblem: a banner is a panel whose fill happens to be art
const BANNER =
  "card selectable store-head flex items-center gap-2 p-2 text-left";

const Banner = (props: { store: DimStore }) => (
  <>
    <img class="size-(--icon-xl) shrink-0" src={props.store.icon} alt="" />
    <div class="min-w-0">
      <div class="header general truncate">{props.store.className}</div>
      <div class="truncate text-sm text-fg/75">
        {props.store.genderRace} · {props.store.powerLevel}
      </div>
    </div>
  </>
);

export const CharacterPicker = (props: Props) => (
  <DropdownMenu gutter={4} sameWidth modal={false} preventScroll={false}>
    <DropdownMenu.Trigger
      class={`${BANNER} w-full`}
      style={{ "--art": `url(${props.selected?.background})` }}
    >
      <For each={props.selected ? [props.selected] : []}>
        {(store) => <Banner store={store} />}
      </For>
      <svg
        class="ml-auto shrink-0 text-text"
        viewBox="0 0 10 6"
        width="10"
        height="6"
        aria-hidden="true"
      >
        <path d="M0 0h10L5 6z" fill="currentColor" />
      </svg>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="picker-menu">
        <For each={props.characters}>
          {(store) => (
            <DropdownMenu.Item
              class={`${BANNER} outline-none data-[highlighted]:border-fg`}
              classList={{ "accent-exotic": store.id === props.selected?.id }}
              style={{ "--art": `url(${store.background})` }}
              onSelect={() => props.onSelect(store)}
            >
              <Banner store={store} />
            </DropdownMenu.Item>
          )}
        </For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
);
