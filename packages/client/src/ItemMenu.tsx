import { ContextMenu } from "@kobalte/core/context-menu";
import { useNavigate } from "@solidjs/router";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { quoteFilterString } from "app/search/query-parser";
import { createSignal, For, Show, type JSX } from "solid-js";

import { useApp } from "./App.tsx";
import { comparable } from "./compare.ts";
import { guest } from "./guest.ts";
import {
  defaultEquip,
  defaultTransfer,
  equipTargets,
  pullBlocked,
  storeLabel,
  transferBlocked,
  transferTargets,
} from "./moveTargets.ts";
import { clear } from "./preview.ts";
import { setOnlyTag, tagDefs, tagFor } from "./tags.ts";
import { cn } from "./ui/cn.ts";
import { entryHref } from "./url.ts";

interface Props {
  find: (index: string) => DimItem | undefined;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
  children: JSX.Element;
}

interface RowProps {
  item: DimItem;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
}

const ROW =
  "menu-item px-3 py-2 text-sm tracking-caps outline-none data-[highlighted]:border-fg data-[highlighted]:bg-surface-active data-[highlighted]:text-fg";

const FRAME =
  "menu-list z-4 bg-panel-raised shadow-[inset_0_0_0_1px_var(--color-line-bright),0_8px_24px_#000c]";

const PANEL = `${FRAME} min-w-44`;

// Narrow enough that the character list still fits beside the menu near a window edge
const SUB_PANEL = `${FRAME} min-w-28`;

const Row = (props: {
  label: string;
  reason?: string;
  class?: string;
  onChoose: () => void;
}) => (
  <ContextMenu.Item
    class={cn(ROW, props.class)}
    classList={{ disabled: Boolean(props.reason) }}
    disabled={Boolean(props.reason)}
    title={props.reason}
    onSelect={props.onChoose}
  >
    {props.label}
  </ContextMenu.Item>
);

interface SplitProps {
  label: string;
  reason: string | undefined;
  onChoose: () => void;
  others: DimStore[];
  reasonFor: (store: DimStore) => string | undefined;
  onChooseOther: (store: DimStore) => void;
}

const SplitRow = (props: SplitProps) => (
  <div class="flex items-stretch">
    <Row
      class="min-w-0 flex-1"
      label={props.label}
      reason={props.reason}
      onChoose={props.onChoose}
    />
    <Show when={props.others.length > 0}>
      <span
        aria-hidden="true"
        class="w-px shrink-0 self-stretch bg-[var(--d2-border-faint)]"
      />
      <ContextMenu.Sub gutter={2}>
        <ContextMenu.SubTrigger
          class={cn(ROW, "shrink-0 px-2")}
          aria-label={`${props.label}: other targets`}
        >
          <svg viewBox="0 0 6 10" width="6" height="10" aria-hidden="true">
            <path d="M0 0v10l6-5z" fill="currentColor" />
          </svg>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent data-menu="item" class={SUB_PANEL}>
            <For each={props.others}>
              {(store) => (
                <Row
                  label={storeLabel(store)}
                  reason={props.reasonFor(store)}
                  onChoose={() => props.onChooseOther(store)}
                />
              )}
            </For>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>
    </Show>
  </div>
);

const TagRows = (props: {
  item: DimItem;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
}) => (
  <ContextMenu.Sub gutter={2}>
    <ContextMenu.SubTrigger class={cn(ROW, "flex items-center gap-2")}>
      <span class="min-w-0 flex-1">Tag</span>
      <span class="text-dim">{tagFor(props.item.id)?.label ?? "No tag"}</span>
      <svg viewBox="0 0 6 10" width="6" height="10" aria-hidden="true">
        <path d="M0 0v10l6-5z" fill="currentColor" />
      </svg>
    </ContextMenu.SubTrigger>
    <ContextMenu.Portal>
      <ContextMenu.SubContent data-menu="item" class={SUB_PANEL}>
        <ContextMenu.RadioGroup
          value={tagFor(props.item.id)?.id ?? ""}
          onChange={(id) => {
            const tagId = id === "" ? undefined : id;

            if (props.onTag) {
              props.onTag(props.item, tagId);

              return;
            }

            setOnlyTag(props.item.id, props.item.hash, tagId);
          }}
        >
          <ContextMenu.RadioItem
            class={cn(ROW, "flex items-center gap-2")}
            value=""
            closeOnSelect={false}
          >
            <span class="tag-dot none" />
            <span class="min-w-0 flex-1">No tag</span>
          </ContextMenu.RadioItem>
          <For each={tagDefs()}>
            {(def) => (
              <ContextMenu.RadioItem
                class={cn(ROW, "flex items-center gap-2")}
                value={def.id}
                closeOnSelect={false}
              >
                <span
                  class="tag-dot"
                  style={{ "background-color": `var(--color-${def.color})` }}
                />
                <span class="min-w-0 flex-1">{def.label}</span>
              </ContextMenu.RadioItem>
            )}
          </For>
        </ContextMenu.RadioGroup>
      </ContextMenu.SubContent>
    </ContextMenu.Portal>
  </ContextMenu.Sub>
);

const Rows = (props: RowProps) => {
  const app = useApp();
  const navigate = useNavigate();
  const pinned = () => app.pinned().some((one) => one.id === props.item.id);

  const rival = () => {
    const [reference] = app.pinned();

    if (!reference || reference.id === props.item.id) {
      return undefined;
    }

    return comparable(reference, props.item) ? reference : undefined;
  };

  const equipOn = () => defaultEquip(props.item, app.stores(), app.active());
  const transferTo = () =>
    defaultTransfer(props.item, app.stores(), app.active());

  const otherEquips = (primary: DimStore) =>
    equipTargets(props.item, app.stores(), app.active()).filter(
      (store) => store.id !== primary.id,
    );

  const otherTransfers = (primary: DimStore) =>
    transferTargets(props.item, app.stores(), app.active()).filter(
      (store) => store.id !== primary.id,
    );

  const equipReason = () => app.moving() ?? pullBlocked(props.item);
  const transferReason = (target: DimStore) =>
    app.moving() ?? transferBlocked(props.item, app.stores(), target);

  return (
    <>
      <Show when={!guest()}>
        <Show when={equipOn()}>
          {(target) => (
            <SplitRow
              label={`Equip on ${storeLabel(target())}`}
              reason={equipReason()}
              onChoose={() => app.onMove(props.item, target(), true)}
              others={otherEquips(target())}
              reasonFor={equipReason}
              onChooseOther={(store) => app.onMove(props.item, store, true)}
            />
          )}
        </Show>

        <Show when={transferTo()}>
          {(target) => (
            <SplitRow
              label={`Transfer to ${storeLabel(target())}`}
              reason={transferReason(target())}
              onChoose={() => app.onMove(props.item, target(), false)}
              others={otherTransfers(target())}
              reasonFor={transferReason}
              onChooseOther={(store) => app.onMove(props.item, store, false)}
            />
          )}
        </Show>

        <Show when={props.item.id !== "0"}>
          <TagRows item={props.item} onTag={props.onTag} />
        </Show>

        <Show when={equipOn() || transferTo() || props.item.id !== "0"}>
          <ContextMenu.Separator class="mx-3 my-1 border-t border-line" />
        </Show>
      </Show>

      <Row
        label={pinned() ? "Unpin" : "Pin"}
        onChoose={() =>
          pinned() ? app.onUnpin(props.item) : app.onPin(props.item)
        }
      />
      <Show when={rival()}>
        {(reference) => (
          <Row
            label={`Compare with ${reference().name}`}
            onChoose={() => app.onCompare(props.item, reference())}
          />
        )}
      </Show>
      <Row
        label="Filter to name"
        onChoose={() =>
          app.onQuery(
            `exactname:${quoteFilterString(props.item.name.toLowerCase())}`,
          )
        }
      />
      <Show when={props.item.bucket.inWeapons || props.item.bucket.inArmor}>
        <Row
          label="Show in collections"
          onChoose={() =>
            navigate(
              entryHref(props.item.hash, {
                kind: props.item.bucket.inArmor ? "armor" : "weapon",
              }),
            )
          }
        />
      </Show>
    </>
  );
};

const [menuFor, setMenuFor] = createSignal<DimItem | undefined>(undefined);
const [menuOpen, setMenuOpen] = createSignal(false);

/** True while this item's context menu is open */
export const menued = (item: DimItem) =>
  menuOpen() && menuFor()?.index === item.index;

/** One menu for a whole list of tiles; find resolves a data-item-index to its item */
export const ItemMenu = (props: Props) => {
  // Capture phase - a miss must not reach the menu's own handler
  const onContextMenu = (event: MouseEvent) => {
    const tile = (event.target as HTMLElement).closest("[data-item-index]");
    const index = tile?.getAttribute("data-item-index") ?? undefined;
    const found = index === undefined ? undefined : props.find(index);

    if (!found) {
      event.stopPropagation();

      return;
    }

    setMenuFor(found);
  };

  const onOpenChange = (open: boolean) => {
    if (open) {
      clear();
    }

    setMenuOpen(open);
  };

  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenu.Trigger
        as="div"
        class="contents"
        on:contextmenu={{ handleEvent: onContextMenu, capture: true }}
      >
        {props.children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        {/* Opaque: this floats over the grid, not over game art */}
        <ContextMenu.Content data-menu="item" class={PANEL}>
          <Show when={menuFor()}>
            {(item) => <Rows item={item()} onTag={props.onTag} />}
          </Show>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu>
  );
};
