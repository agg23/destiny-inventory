import type { DimItem } from "app/inventory/item-types";
import { For } from "solid-js";

import { requestTag } from "../../core/items/tagConfirm.ts";
import { tagDefs, tagSummary } from "../../core/items/tags.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../lib/zaidan/dropdown-menu.tsx";
import { TagDot } from "../TagDot.tsx";

/** The tag dropdown, setting one tag across every item it is given */
export const TagControl = (props: { items: DimItem[] }) => {
  const summary = () => tagSummary(props.items);
  const current = () => summary().current;
  const tint = () => `var(--${current()?.color ?? "line-bright"})`;

  const apply = (tagId: string | undefined) => requestTag(props.items, tagId);

  return (
    <DropdownMenu placement="bottom-end" modal={false} preventScroll={false}>
      <DropdownMenuTrigger
        class="tag-control"
        classList={{ tagged: !!current() }}
        style={{ "--tag": tint() }}
        aria-label={current() ? `Tag: ${current()!.label}` : summary().label}
        title={summary().label}
      >
        {summary().label}
      </DropdownMenuTrigger>
      <DropdownMenuContent data-menu="tag" class="min-w-32">
        <DropdownMenuItem
          onSelect={() => apply(undefined)}
        >
          <TagDot />
          No tag
        </DropdownMenuItem>
        <For each={tagDefs()}>
          {(def) => (
            <DropdownMenuItem
              onSelect={() => apply(def.id)}
            >
              <TagDot color={def.color} />
              {def.label}
            </DropdownMenuItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
