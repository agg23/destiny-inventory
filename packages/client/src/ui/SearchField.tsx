import { Show, splitProps, type ComponentProps, type JSX } from "solid-js";

import { cn } from "./cn.ts";
import { Button } from "./zaidan/button.tsx";
import { X } from "./zaidan/icons.tsx";
import { Input } from "./zaidan/input.tsx";

type Props = ComponentProps<typeof Input> & {
  value: string;
  /** Shown at the trailing edge, like a match count */
  trailing?: JSX.Element;
  wrapper?: string;
  onClear: () => void;
  children?: JSX.Element;
};

/** Search input with a clear button. Children overlay it, like a menu */
export const SearchField = (props: Props) => {
  const [local, rest] = splitProps(props, [
    "class",
    "value",
    "trailing",
    "wrapper",
    "onClear",
    "children",
  ]);

  return (
    <div class={cn("relative", local.wrapper)} data-menu>
      <Input
        type="search"
        autocomplete="off"
        spellcheck={false}
        class={cn(
          "pr-8 [&::-webkit-search-cancel-button]:appearance-none",
          local.class,
        )}
        value={local.value}
        {...rest}
      />

      <div class="pointer-events-none absolute inset-y-0 right-1 z-2 flex items-center gap-1">
        <Show when={local.trailing}>
          <span class="text-xs text-muted-foreground tabular-nums">
            {local.trailing}
          </span>
        </Show>

        <Show
          when={local.value !== ""}
          fallback={<span class="size-6" aria-hidden="true" />}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            class="pointer-events-auto text-muted-foreground"
            title="Clear"
            aria-label="Clear"
            onMouseDown={(event: MouseEvent) => event.preventDefault()}
            onClick={local.onClear}
          >
            <X />
          </Button>
        </Show>
      </div>

      {local.children}
    </div>
  );
};
