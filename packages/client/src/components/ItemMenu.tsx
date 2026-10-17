import { ContextMenu } from "@kobalte/core/context-menu";
import { useNavigate } from "@solidjs/router";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { quoteFilterString } from "app/search/query-parser";
import { For, Show, type JSX } from "solid-js";

import { useApp } from "../core/app/state.ts";
import { rivalFor } from "../core/items/compare.ts";
import { menuFor, setMenuFor, setMenuOpen } from "../core/items/itemMenu.ts";
import { clear } from "../core/items/preview.ts";
import { requestTag } from "../core/items/tagConfirm.ts";
import {
  setOnlyTag,
  tagDefs,
  tagFor,
  tagSummary,
} from "../core/items/tags.ts";
import { guest } from "../core/profile/guest.ts";
import {
  bulkBlocked,
  defaultBulkTransfer,
  defaultEquip,
  defaultTransfer,
  equipTargets,
  movableTo,
  otherStores,
  pullBlocked,
  storeLabel,
  transferBlocked,
  transferTargets,
} from "../core/profile/moveTargets.ts";
import { itemEntryHref } from "../core/url.ts";
import { cn } from "./lib/cn.ts";
import { Check, ChevronRight } from "./lib/zaidan/icons.tsx";
import { TagDot } from "./TagDot.tsx";

interface Props {
  find: (index: string) => DimItem | undefined;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
  selection?: () => DimItem[];
  children: JSX.Element;
}

interface RowProps {
  item: DimItem;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
}

const ROW =
  "relative z-context-menu-item flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50";

const FRAME =
  "z-50 z-context-menu-content max-h-(--kb-popper-available-height) overflow-y-auto outline-none";

const PANEL = `${FRAME} min-w-44`;

// Fits beside the menu near a window edge
const SUB_PANEL = `${FRAME} min-w-28`;

const Row = (props: {
  label: string;
  reason?: string;
  class?: string;
  onChoose: () => void;
}) => (
  <ContextMenu.Item
    class={cn(ROW, props.class)}
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
      <span aria-hidden="true" class="my-1 w-px shrink-0 bg-border" />
      <ContextMenu.Sub gutter={6}>
        <ContextMenu.SubTrigger
          class={cn(ROW, "z-context-menu-sub-trigger shrink-0 text-muted-foreground")}
          aria-label={`${props.label}: other targets`}
        >
          <ChevronRight />
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

const TagChoice = (props: {
  value: string;
  label: string;
  color?: string;
  closeOnSelect?: boolean;
}) => (
  <ContextMenu.RadioItem
    class={cn(ROW, "z-context-menu-radio-item")}
    value={props.value}
    closeOnSelect={!!props.closeOnSelect}
  >
    <TagDot color={props.color} />
    <span class="min-w-0 flex-1">{props.label}</span>
    <ContextMenu.ItemIndicator class="z-context-menu-item-indicator">
      <Check />
    </ContextMenu.ItemIndicator>
  </ContextMenu.RadioItem>
);

interface TagSubProps {
  label: string;
  value: string | undefined;
  closeOnSelect?: boolean;
  onChoose: (tagId: string | undefined) => void;
}

const TagSub = (props: TagSubProps) => (
  <ContextMenu.Sub gutter={6}>
    <ContextMenu.SubTrigger class={cn(ROW, "z-context-menu-sub-trigger")}>
      <span class="min-w-0 flex-1">Tag</span>
      <span class="text-muted-foreground">{props.label}</span>
      <ChevronRight class="text-muted-foreground" />
    </ContextMenu.SubTrigger>
    <ContextMenu.Portal>
      <ContextMenu.SubContent data-menu="item" class={SUB_PANEL}>
        <ContextMenu.RadioGroup
          value={props.value}
          onChange={(id) => props.onChoose(id === "" ? undefined : id)}
        >
          <TagChoice
            value=""
            label="No tag"
            closeOnSelect={props.closeOnSelect}
          />
          <For each={tagDefs()}>
            {(def) => (
              <TagChoice
                value={def.id}
                label={def.label}
                color={def.color}
                closeOnSelect={props.closeOnSelect}
              />
            )}
          </For>
        </ContextMenu.RadioGroup>
      </ContextMenu.SubContent>
    </ContextMenu.Portal>
  </ContextMenu.Sub>
);

const SelectionRows = (props: { items: DimItem[] }) => {
  const app = useApp();

  const summary = () => tagSummary(props.items);
  const reason = (target: DimStore) =>
    app.moving() ??
    bulkBlocked(props.items, app.stores(), app.active(), target);
  const moveTo = (target: DimStore) =>
    app.onMoveMany(
      movableTo(props.items, app.stores(), app.active(), target),
      target,
    );
  const transferTo = () =>
    defaultBulkTransfer(props.items, app.stores(), app.active());

  return (
    <ContextMenu.Group>
      <ContextMenu.GroupLabel class="z-dropdown-menu-label">
        {props.items.length} items
      </ContextMenu.GroupLabel>
      <Show when={!guest()}>
        <Show when={transferTo()}>
          {(target) => (
            <SplitRow
              label={`Transfer to ${storeLabel(target())}`}
              reason={reason(target())}
              onChoose={() => moveTo(target())}
              others={otherStores(app.stores(), target())}
              reasonFor={reason}
              onChooseOther={moveTo}
            />
          )}
        </Show>
        <TagSub
          label={summary().label}
          value={summary().mixed ? undefined : (summary().current?.id ?? "")}
          closeOnSelect
          onChoose={(tagId) => requestTag(props.items, tagId)}
        />
      </Show>
      <ContextMenu.Separator class="z-context-menu-separator border-0" />
      <Row label="Clear selection" onChoose={app.onClearSelection} />
    </ContextMenu.Group>
  );
};

const Rows = (props: RowProps) => {
  const app = useApp();
  const navigate = useNavigate();
  const pinned = () => app.pinned().some((one) => one.id === props.item.id);

  const rival = () => rivalFor(app.pinned(), props.item);

  const equipOn = () => defaultEquip(props.item, app.stores(), app.active());
  const transferTo = () =>
    defaultTransfer(props.item, app.stores(), app.active());

  const otherEquips = (primary: DimStore) =>
    otherStores(equipTargets(props.item, app.stores(), app.active()), primary);

  const otherTransfers = (primary: DimStore) =>
    otherStores(
      transferTargets(props.item, app.stores(), app.active()),
      primary,
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
          <TagSub
            label={tagFor(props.item.id)?.label ?? "No tag"}
            value={tagFor(props.item.id)?.id ?? ""}
            onChoose={(tagId) => {
              if (props.onTag) {
                props.onTag(props.item, tagId);

                return;
              }

              setOnlyTag(props.item.id, props.item.hash, tagId);
            }}
          />
        </Show>

        <Show when={equipOn() || transferTo() || props.item.id !== "0"}>
          <ContextMenu.Separator class="z-context-menu-separator border-0" />
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
          label="Show in Collections"
          onChoose={() =>
            navigate(
              itemEntryHref(props.item),
            )
          }
        />
      </Show>
    </>
  );
};

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

  const swept = (item: DimItem): DimItem[] | undefined => {
    const chosen = props.selection?.() ?? [];

    return chosen.length > 1 && chosen.some((one) => one.id === item.id)
      ? chosen
      : undefined;
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
        <ContextMenu.Content data-menu="item" class={PANEL}>
          <Show when={menuFor()}>
            {(item) => (
              <Show
                when={swept(item())}
                fallback={<Rows item={item()} onTag={props.onTag} />}
              >
                {(items) => <SelectionRows items={items()} />}
              </Show>
            )}
          </Show>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu>
  );
};
