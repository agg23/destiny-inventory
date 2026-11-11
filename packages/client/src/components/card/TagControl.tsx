import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import type { TagDef } from "@dvm/service";

import { ruleQuery } from "../../core/items/autotag.ts";
import { requestTag } from "../../core/items/tagConfirm.ts";
import { tagDefs, tagRuleFor, tagSummary } from "../../core/items/tags.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../lib/zaidan/dropdown-menu.tsx";
import { TagDot } from "../TagDot.tsx";

interface MenuProps {
  current: TagDef | undefined;
  label: string;
  ruleId?: string;
  onSelect: (tagId: string | undefined) => void;
}

/** The tag dropdown over any value */
export const TagMenu = (props: MenuProps) => {
  const current = () => props.current;
  const tint = () => `var(--${current()?.color ?? "line-bright"})`;

  return (
    <DropdownMenu placement="bottom-end" modal={false} preventScroll={false}>
      <DropdownMenuTrigger
        class="tag-control"
        classList={{ tagged: !!current() }}
        style={{ "--tag": tint() }}
        aria-label={current() ? `Tag: ${current()!.label}` : props.label}
        title={props.label}
      >
        <Show when={props.ruleId}>
          <span class="tag-auto">Auto</span>
        </Show>
        {props.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent data-menu="tag" class="max-w-64 min-w-32">
        <Show when={props.ruleId}>
          {(ruleId) => (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel class="flex flex-col gap-0.5">
                  Set via autotag
                  <Show when={ruleQuery(ruleId())}>
                    {(query) => (
                      <span class="font-mono text-xs font-normal break-words">
                        {query()}
                      </span>
                    )}
                  </Show>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
        </Show>
        <DropdownMenuItem
          onSelect={() => props.onSelect(undefined)}
        >
          <TagDot />
          No tag
        </DropdownMenuItem>
        <For each={tagDefs()}>
          {(def) => (
            <DropdownMenuItem
              onSelect={() => props.onSelect(def.id)}
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

/** The tag dropdown, setting one tag across every item it is given */
export const TagControl = (props: { items: DimItem[] }) => {
  const summary = () => tagSummary(props.items);
  const ruleId = () =>
    props.items.length === 1 ? tagRuleFor(props.items[0]!.id) : undefined;

  return (
    <TagMenu
      current={summary().current}
      label={summary().label}
      ruleId={ruleId()}
      onSelect={(tagId) => requestTag(props.items, tagId)}
    />
  );
};
