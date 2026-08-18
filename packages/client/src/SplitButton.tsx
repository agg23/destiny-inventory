import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { For, Show } from "solid-js";

export interface Choice {
  id: string;
  label: string;
  onChoose: () => void;
}

interface Props {
  label: string;
  disabled: boolean;
  onPrimary: () => void;
  choices: Choice[];
}

/**
 * A default action plus the alternatives behind a caret. Picking from the list performs the
 * action rather than only selecting a target, so the alternatives cost one click, not two.
 */
export const SplitButton = (props: Props) => (
  <div class="split">
    <button type="button" class="split-main" disabled={props.disabled} onClick={props.onPrimary}>
      {props.label}
    </button>
    <Show when={props.choices.length > 0}>
      <DropdownMenu gutter={4} placement="bottom-end">
        <DropdownMenu.Trigger
          class="split-more"
          disabled={props.disabled}
          aria-label={`${props.label}: other targets`}
        >
          <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
            <path d="M0 0h10L5 6z" fill="currentColor" />
          </svg>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="split-menu">
            <For each={props.choices}>
              {(choice) => (
                <DropdownMenu.Item class="split-choice" onSelect={choice.onChoose}>
                  {choice.label}
                </DropdownMenu.Item>
              )}
            </For>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Show>
  </div>
);
