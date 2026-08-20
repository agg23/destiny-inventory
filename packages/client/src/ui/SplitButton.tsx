import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { For, Show } from "solid-js";

import { Button, VARIANT } from "./Button.tsx";
import { cn } from "./cn.ts";

export interface Choice {
  id: string;
  label: string;
  // A choice that cannot be taken right now, and why; shown in its title
  reason?: string;
  onChoose: () => void;
}

type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  disabled?: boolean;
  // Why the control is disabled; a disabled button still shows its title on hover
  title?: string;
  variant?: keyof typeof VARIANT;
  size?: Size;
  // Fills its container rather than its label, for a column of controls that line up
  block?: boolean;
  onPrimary: () => void;
  choices: Choice[];
}

const CARET: Record<Size, "icon-sm" | "icon-md" | "icon-lg"> = {
  sm: "icon-sm",
  md: "icon-md",
  lg: "icon-lg",
};

// The same border tints buttons.scss gives each variant, moved up onto the pair
const FRAME: Record<keyof typeof VARIANT, string> = {
  default: "border-[var(--d2-border)]",
  light: "border-[color-mix(in_srgb,var(--d2-rarity-exotic)_80%,transparent)]",
  danger: "border-[color-mix(in_srgb,var(--d2-danger)_80%,transparent)]",
  ghost: "border-transparent",
};

// The frame belongs to the pair, not to either half, or it reads as two controls that happen
// to touch. The halves keep only their own fill, split by a hairline
export const SplitButton = (props: Props) => {
  const size = (): Size => props.size ?? "md";

  // The primary is always in the list, so one choice means the menu only repeats the button.
  // The caret stays put and greys out rather than coming and going between items
  const alone = () => props.choices.length < 2;

  // The pair fades as one; the halves must not fade again inside it
  const half = () => cn("border-0", props.disabled && "disabled:opacity-100");

  return (
    <div
      class={cn(
        "relative border",
        // Block fills its column and lets the label truncate; inline is only ever as wide as
        // the pair, and must not be squeezed narrower than halves that refuse to shrink
        props.block ? "flex w-full min-w-0" : "inline-flex shrink-0",
        FRAME[props.variant ?? "default"],
        props.disabled && "opacity-35",
      )}
      title={props.title}
    >
      <Button
        type="button"
        variant={props.variant}
        size={size()}
        disabled={props.disabled}
        onClick={props.onPrimary}
        class={cn(half(), "min-w-0 truncate", props.block && "flex-1")}
      >
        {props.label}
      </Button>
      <Show when={props.choices.length > 0}>
        <div
          aria-hidden="true"
          class="w-px shrink-0 self-stretch bg-[var(--d2-border-faint)]"
        />
        <DropdownMenu
          gutter={4}
          placement="bottom-end"
          modal={false}
          preventScroll={false}
        >
          <DropdownMenu.Trigger
            as={Button}
            variant={props.variant}
            size={CARET[size()]}
            disabled={props.disabled || alone()}
            class={half()}
            aria-label={`${props.label}: choose target`}
          >
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
              <path d="M0 0h10L5 6z" fill="currentColor" />
            </svg>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            {/* The framework's menu rows, on an opaque panel because this one floats over
                the grid rather than over the game's own background */}
            <DropdownMenu.Content
              data-menu="split"
              class="menu-list z-4 min-w-40 bg-panel-raised shadow-[inset_0_0_0_1px_var(--color-line-bright),0_8px_24px_#000c]"
            >
              <For each={props.choices}>
                {(choice) => (
                  <DropdownMenu.Item
                    class="menu-item outline-none data-[highlighted]:border-fg data-[highlighted]:bg-surface-active data-[highlighted]:text-fg"
                    classList={{ disabled: Boolean(choice.reason) }}
                    disabled={Boolean(choice.reason)}
                    title={choice.reason}
                    onSelect={choice.onChoose}
                  >
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
};
