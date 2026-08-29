import { ContextMenu } from "@kobalte/core/context-menu";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { quoteFilterString } from "app/search/query-parser";
import { For, Show, type JSX } from "solid-js";

import { comparable } from "./compare.ts";
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
import { cn } from "./ui/cn.ts";

interface Props {
  item: DimItem;
  stores: DimStore[];
  active: DimStore | undefined;
  pinned: DimItem[];
  moving: string | undefined;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onPin: (item: DimItem) => void;
  onUnpin: (item: DimItem) => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
  onQuery: (query: string) => void;
  children: JSX.Element;
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

export const ItemMenu = (props: Props) => {
  const pinned = () => props.pinned.some((one) => one.id === props.item.id);

  const rival = () => {
    const [reference] = props.pinned;

    if (!reference || reference.id === props.item.id) {
      return undefined;
    }

    return comparable(reference, props.item) ? reference : undefined;
  };

  const equipOn = () => defaultEquip(props.item, props.stores, props.active);
  const transferTo = () =>
    defaultTransfer(props.item, props.stores, props.active);

  const otherEquips = (primary: DimStore) =>
    equipTargets(props.item, props.stores, props.active).filter(
      (store) => store.id !== primary.id,
    );

  const otherTransfers = (primary: DimStore) =>
    transferTargets(props.item, props.stores, props.active).filter(
      (store) => store.id !== primary.id,
    );

  const equipReason = () => props.moving ?? pullBlocked(props.item);
  const transferReason = (target: DimStore) =>
    props.moving ?? transferBlocked(props.item, props.stores, target);

  return (
    <ContextMenu onOpenChange={(open) => open && clear()}>
      <ContextMenu.Trigger as="span" class="tile-menu contents">
        {props.children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        {/* Opaque: this floats over the grid, not over game art */}
        <ContextMenu.Content data-menu="item" class={PANEL}>
          <Show when={equipOn()}>
            {(target) => (
              <SplitRow
                label={`Equip on ${storeLabel(target())}`}
                reason={equipReason()}
                onChoose={() => props.onMove(props.item, target(), true)}
                others={otherEquips(target())}
                reasonFor={equipReason}
                onChooseOther={(store) => props.onMove(props.item, store, true)}
              />
            )}
          </Show>

          <Show when={transferTo()}>
            {(target) => (
              <SplitRow
                label={`Transfer to ${storeLabel(target())}`}
                reason={transferReason(target())}
                onChoose={() => props.onMove(props.item, target(), false)}
                others={otherTransfers(target())}
                reasonFor={transferReason}
                onChooseOther={(store) =>
                  props.onMove(props.item, store, false)
                }
              />
            )}
          </Show>

          <Show when={equipOn() || transferTo()}>
            <ContextMenu.Separator class="mx-3 my-1 border-t border-line" />
          </Show>

          <Row
            label={pinned() ? "Unpin" : "Pin"}
            onChoose={() =>
              pinned() ? props.onUnpin(props.item) : props.onPin(props.item)
            }
          />
          <Show when={rival()}>
            {(reference) => (
              <Row
                label={`Compare with ${reference().name}`}
                onChoose={() => props.onCompare(props.item, reference())}
              />
            )}
          </Show>
          <Row
            label="Search similar"
            onChoose={() =>
              props.onQuery(
                `exactname:${quoteFilterString(props.item.name.toLowerCase())}`,
              )
            }
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu>
  );
};
