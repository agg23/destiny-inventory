import type { DimItem } from "app/inventory/item-types";
import { For } from "solid-js";

import { requestTag } from "../../core/items/tagConfirm.ts";
import { commonTag, tagDefs } from "../../core/items/tags.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../lib/zaidan/dropdown-menu.tsx";

/** The tag dropdown, setting one tag across every item it is given */
export const TagControl = (props: { items: DimItem[] }) => {
  const shared = () => commonTag(props.items);
  const current = () => {
    const tag = shared();

    return tag === "mixed" ? undefined : tag;
  };
  const label = () =>
    shared() === "mixed" ? "Mixed" : (current()?.label ?? "No tag");
  const tint = () => `var(--${current()?.color ?? "line-bright"})`;

  const apply = (tagId: string | undefined) => requestTag(props.items, tagId);

  return (
    <DropdownMenu placement="bottom-end" modal={false} preventScroll={false}>
      <DropdownMenuTrigger
        class="tag-control"
        classList={{ tagged: !!current() }}
        style={{ "--tag": tint() }}
        aria-label={current() ? `Tag: ${current()!.label}` : label()}
        title={label()}
      >
        {label()}
      </DropdownMenuTrigger>
      <DropdownMenuContent data-menu="tag" class="min-w-32">
        <DropdownMenuItem
          onSelect={() => apply(undefined)}
        >
          <span class="size-2 rounded-full border border-dashed border-input" />
          No tag
        </DropdownMenuItem>
        <For each={tagDefs()}>
          {(def) => (
            <DropdownMenuItem
              onSelect={() => apply(def.id)}
            >
              <span
                class="size-2 rounded-full"
                style={{ "background-color": `var(--color-${def.color})` }}
              />
              {def.label}
            </DropdownMenuItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
