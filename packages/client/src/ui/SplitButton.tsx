import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { For, Show } from "solid-js";

import { Button, VARIANT } from "./Button.tsx";
import { cn } from "./cn.ts";

export interface Choice {
  id: string;
  label: string;
  reason?: string;
  onChoose: () => void;
}

type Size = "xs" | "sm" | "md" | "lg";

interface Props {
  label: string;
  disabled?: boolean;
  title?: string;
  variant?: keyof typeof VARIANT;
  size?: Size;
  block?: boolean;
  onPrimary: () => void;
  choices: Choice[];
}

const CARET: Record<Size, `icon-${Size}`> = {
  xs: "icon-xs",
  sm: "icon-sm",
  md: "icon-md",
  lg: "icon-lg",
};

// Framework's row is 16.8px on 3.2px tracking
const ROW: Record<Size, string> = {
  xs: "px-3 py-2 text-sm tracking-caps",
  sm: "px-3 py-2 text-sm tracking-caps",
  md: "",
  lg: "",
};

// Border tints from buttons.scss
const FRAME: Record<keyof typeof VARIANT, string> = {
  default: "border-[var(--d2-border)]",
  light: "border-[color-mix(in_srgb,var(--d2-rarity-exotic)_80%,transparent)]",
  danger: "border-[color-mix(in_srgb,var(--d2-danger)_80%,transparent)]",
  ghost: "border-transparent",
};

export const SplitButton = (props: Props) => {
  const size = (): Size => props.size ?? "md";

  const alone = () => props.choices.length < 2;

  const half = () => cn("border-0", props.disabled && "disabled:opacity-100");

  return (
    <div
      class={cn(
        "relative border",
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
            {/* Opaque: this floats over the grid, not over game art */}
            <DropdownMenu.Content
              data-menu="split"
              class="menu-list z-4 min-w-40 bg-panel-raised shadow-[inset_0_0_0_1px_var(--color-line-bright),0_8px_24px_#000c]"
            >
              <For each={props.choices}>
                {(choice) => (
                  <DropdownMenu.Item
                    class={cn(
                      "menu-item outline-none data-[highlighted]:border-fg data-[highlighted]:bg-surface-active data-[highlighted]:text-fg",
                      ROW[size()],
                    )}
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
