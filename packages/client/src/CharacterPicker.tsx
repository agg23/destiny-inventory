import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import type { DimStore } from "app/inventory/store-types";
import { For } from "solid-js";

interface Props {
  characters: DimStore[];
  selected: DimStore | undefined;
  onSelect: (store: DimStore) => void;
}

const Banner = (props: { store: DimStore }) => (
  <>
    <img src={props.store.icon} alt="" width="40" height="40" />
    <div>
      <div class="name">{props.store.className}</div>
      <div class="meta">
        {props.store.genderRace} · {props.store.powerLevel}
      </div>
    </div>
  </>
);

export const CharacterPicker = (props: Props) => (
  <DropdownMenu gutter={4} sameWidth>
    <DropdownMenu.Trigger
      class="store-head picker"
      style={{ "background-image": `url(${props.selected?.background})` }}
    >
      <For each={props.selected ? [props.selected] : []}>
        {(store) => <Banner store={store} />}
      </For>
      <svg
        class="caret"
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
              class="store-head"
              classList={{ active: store.id === props.selected?.id }}
              style={{ "background-image": `url(${store.background})` }}
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
