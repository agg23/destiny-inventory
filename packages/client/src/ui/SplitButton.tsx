import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { For, Show } from "solid-js";

import { ACCENT, Button, GLOW, RING, type ButtonProps } from "./Button.tsx";
import { cn } from "./cn.ts";

export interface Choice {
  id: string;
  label: string;
  onChoose: () => void;
}

type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  disabled?: boolean;
  variant?: keyof typeof ACCENT;
  size?: Size;
  // Fills its container rather than its label, for a column of controls that line up
  block?: boolean;
  onPrimary: () => void;
  choices: Choice[];
}

const CARET: Record<Size, ButtonProps["size"]> = {
  sm: "icon-sm",
  md: "icon-md",
  lg: "icon-lg",
};

const DISABLED_RING =
  "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-fg)_10%,transparent)]";

// The outline and the hover ring belong to the pair, not to either half, or it reads as two
// controls that happen to touch. The halves keep only their own fill, split by a hairline
export const SplitButton = (props: Props) => {
  const size = (): Size => props.size ?? "md";

  // The primary is always in the list, so one choice means the menu only repeats the button.
  // The caret stays put and greys out rather than coming and going between items
  const alone = () => props.choices.length < 2;

  return (
    <div
      class={cn(
        "relative min-w-0",
        props.block ? "flex w-full" : "inline-flex",
        ACCENT[props.variant ?? "default"],
        RING,
        props.disabled ? DISABLED_RING : GLOW,
      )}
    >
      <Button
        type="button"
        ring="off"
        glow="off"
        size={size()}
        disabled={props.disabled}
        onClick={props.onPrimary}
        class={cn("min-w-0 truncate", props.block && "flex-1")}
      >
        {props.label}
      </Button>
      <Show when={props.choices.length > 0}>
        <div
          aria-hidden="true"
          class="w-px shrink-0 self-stretch bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
        />
        <DropdownMenu
          gutter={4}
          placement="bottom-end"
          modal={false}
          preventScroll={false}
        >
          <DropdownMenu.Trigger
            as={Button}
            ring="off"
            glow="off"
            size={CARET[size()]}
            disabled={props.disabled || alone()}
            aria-label={`${props.label}: choose target`}
          >
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
              <path d="M0 0h10L5 6z" fill="currentColor" />
            </svg>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              data-menu="split"
              class="z-4 flex min-w-30 flex-col bg-panel-raised p-1 shadow-[inset_0_0_0_1px_var(--color-line-bright),0_8px_24px_#000c]"
            >
              <For each={props.choices}>
                {(choice) => (
                  <DropdownMenu.Item
                    class="cursor-pointer whitespace-nowrap px-2 py-1.5 text-md outline-none data-[highlighted]:bg-surface-active data-[highlighted]:text-fg"
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
