import { ContextMenu } from "@kobalte/core/context-menu";
import { useNavigate } from "@solidjs/router";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { quoteFilterString } from "app/search/query-parser";
import { createSignal, For, Show, type JSX } from "solid-js";

import { useApp } from "../App.tsx";
import { comparable } from "../core/items/compare.ts";
import { clear } from "../core/items/preview.ts";
import { requestTag } from "../core/items/tagConfirm.ts";
import { commonTag, setOnlyTag, tagDefs, tagFor } from "../core/items/tags.ts";
import { guest } from "../core/profile/guest.ts";
import {
  defaultBulkTransfer,
  defaultEquip,
  defaultTransfer,
  equipTargets,
  movableTo,
  pullBlocked,
  storeLabel,
  transferBlocked,
  transferTargets,
} from "../core/profile/moveTargets.ts";
import { entryHref } from "../core/url.ts";
import { cn } from "./lib/cn.ts";
import { Check, ChevronRight } from "./lib/zaidan/icons.tsx";

interface Props {
  find: (index: string) => DimItem | undefined;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
  /** Right-clicking inside this acts on all of it */
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

const TagChoices = (props: { closeOnSelect?: boolean }) => (
  <>
    <ContextMenu.RadioItem
      class={cn(ROW, "z-context-menu-radio-item")}
      value=""
      closeOnSelect={!!props.closeOnSelect}
    >
      <span class="size-2 rounded-full border border-dashed border-input" />
      <span class="min-w-0 flex-1">No tag</span>
      <ContextMenu.ItemIndicator class="z-context-menu-item-indicator">
        <Check />
      </ContextMenu.ItemIndicator>
    </ContextMenu.RadioItem>
    <For each={tagDefs()}>
      {(def) => (
        <ContextMenu.RadioItem
          class={cn(ROW, "z-context-menu-radio-item")}
          value={def.id}
          closeOnSelect={!!props.closeOnSelect}
        >
          <span
            class="size-2 rounded-full"
            style={{ "background-color": `var(--color-${def.color})` }}
          />
          <span class="min-w-0 flex-1">{def.label}</span>
          <ContextMenu.ItemIndicator class="z-context-menu-item-indicator">
            <Check />
          </ContextMenu.ItemIndicator>
        </ContextMenu.RadioItem>
      )}
    </For>
  </>
);

const TagRows = (props: {
  item: DimItem;
  onTag?: (item: DimItem, tagId: string | undefined) => void;
}) => (
  <ContextMenu.Sub gutter={6}>
    <ContextMenu.SubTrigger class={cn(ROW, "z-context-menu-sub-trigger")}>
      <span class="min-w-0 flex-1">Tag</span>
      <span class="text-muted-foreground">
        {tagFor(props.item.id)?.label ?? "No tag"}
      </span>
      <ChevronRight class="text-muted-foreground" />
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
          <TagChoices />
        </ContextMenu.RadioGroup>
      </ContextMenu.SubContent>
    </ContextMenu.Portal>
  </ContextMenu.Sub>
);

const SelectionRows = (props: { items: DimItem[] }) => {
  const app = useApp();

  const shared = () => commonTag(props.items);
  const current = () => {
    const tag = shared();

    return tag === "mixed" ? undefined : tag;
  };
  const reason = (target: DimStore) =>
    app.moving() ??
    (movableTo(props.items, app.stores(), app.active(), target).length === 0
      ? "Nothing to move"
      : undefined);
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
              others={app.stores().filter((store) => store.id !== target().id)}
              reasonFor={reason}
              onChooseOther={moveTo}
            />
          )}
        </Show>
        <ContextMenu.Sub gutter={6}>
          <ContextMenu.SubTrigger class={cn(ROW, "z-context-menu-sub-trigger")}>
            <span class="min-w-0 flex-1">Tag</span>
            <span class="text-muted-foreground">
              {shared() === "mixed" ? "Mixed" : (current()?.label ?? "No tag")}
            </span>
            <ChevronRight class="text-muted-foreground" />
          </ContextMenu.SubTrigger>
          <ContextMenu.Portal>
            <ContextMenu.SubContent data-menu="item" class={SUB_PANEL}>
              <ContextMenu.RadioGroup
                value={shared() === "mixed" ? undefined : (current()?.id ?? "")}
                onChange={(id) =>
                  requestTag(props.items, id === "" ? undefined : id)
                }
              >
                <TagChoices closeOnSelect />
              </ContextMenu.RadioGroup>
            </ContextMenu.SubContent>
          </ContextMenu.Portal>
        </ContextMenu.Sub>
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
