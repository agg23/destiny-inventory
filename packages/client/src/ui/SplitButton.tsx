import { For, Show } from "solid-js";

import { cn } from "./cn.ts";
import { Button } from "./zaidan/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./zaidan/dropdown-menu.tsx";
import { ChevronDown } from "./zaidan/icons.tsx";

export interface Choice {
  id: string;
  label: string;
  reason?: string;
  onChoose: () => void;
}

interface Props {
  label: string;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
  block?: boolean;
  onPrimary: () => void;
  choices: Choice[];
}

export const SplitButton = (props: Props) => {
  const size = () => props.size ?? "default";

  return (
    <div
      class={cn(
        props.block ? "flex w-full min-w-0" : "inline-flex shrink-0",
        props.disabled && "opacity-50",
      )}
      title={props.title}
    >
      <Button
        type="button"
        variant={props.variant ?? "outline"}
        size={size()}
        disabled={props.disabled}
        onClick={props.onPrimary}
        class={cn(
          "min-w-0 truncate disabled:opacity-100",
          props.choices.length > 0 && "rounded-r-none",
          props.block && "flex-1",
        )}
      >
        {props.label}
      </Button>
      <Show when={props.choices.length > 0}>
        <DropdownMenu
          placement="bottom-end"
          modal={false}
          preventScroll={false}
        >
          <DropdownMenuTrigger
            as={Button}
            variant={props.variant ?? "outline"}
            size={size() === "sm" ? "icon-sm" : "icon"}
            disabled={props.disabled || props.choices.length < 2}
            class="-ml-px rounded-l-none disabled:opacity-100"
            aria-label={`${props.label}: choose target`}
          >
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent data-menu="split" class="min-w-40">
            <For each={props.choices}>
              {(choice) => (
                <DropdownMenuItem
                  disabled={Boolean(choice.reason)}
                  title={choice.reason}
                  onSelect={choice.onChoose}
                >
                  {choice.label}
                </DropdownMenuItem>
              )}
            </For>
          </DropdownMenuContent>
        </DropdownMenu>
      </Show>
    </div>
  );
};
