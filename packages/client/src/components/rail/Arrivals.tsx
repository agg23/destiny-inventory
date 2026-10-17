import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { For, Show } from "solid-js";

import {
  verdictFor,
  verdictMode,
  type Verdict,
} from "../../core/items/arrivals.ts";
import { dismiss, preview } from "../../core/items/preview.ts";
import { shownModes } from "../../core/settings.ts";
import { ItemIcon } from "../ItemIcon.tsx";
import { menued } from "../ItemMenu.tsx";
import { typeName } from "../ItemPanel.tsx";
import { HEADING, ROW } from "../lib/text.ts";
import { VersionGlyph } from "../lib/VersionGlyph.tsx";

interface Props {
  items: DimItem[];
  stores: DimStore[];
  onSelect: (item: DimItem) => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
}

const WORDING: Record<Verdict["kind"], string> = {
  only: "Only instance",
  better: "Better perks",
  equal: "About the same",
  worse: "Worse perks",
  mixed: "Different strengths",
};

const RollVerdict = (props: { item: DimItem; stores: DimStore[] }) => (
  <Show when={verdictFor(props.item, props.stores, shownModes())}>
    {(verdict) => (
      <span
        classList={{
          "text-good": verdict().kind === "better",
          "text-destructive": verdict().kind === "worse",
        }}
      >
        {WORDING[verdict().kind]}
        <Show when={verdictMode(verdict())}>{(mode) => <> in {mode()}</>}</Show>
        <Show
          when={
            !!verdict().rival && verdict().rival!.hash !== props.item.hash
          }
        >
          {" "}
          <span
            class="inline-block size-[1em] align-[-0.125em]"
            title="Different version"
            role="img"
            aria-label="Different version"
          >
            <VersionGlyph />
          </span>
        </Show>
      </span>
    )}
  </Show>
);

export const Arrivals = (props: Props) => (
  <div class="arrivals flex min-h-0 flex-col gap-2 overflow-hidden p-4">
    <h2 class={HEADING}>Recently acquired</h2>
    <Show
      when={props.items.length > 0}
      fallback={<p class="text-muted-foreground">Nothing acquired yet.</p>}
    >
      <ul class="-mx-1.5 flex min-h-0 flex-col overflow-y-auto">
        <For each={props.items}>
          {(item) => (
            <li>
              <button
                type="button"
                class={ROW}
                classList={{ "bg-accent": menued(item) }}
                data-item-index={item.index}
                onClick={() => {
                  const rival = verdictFor(
                    item,
                    props.stores,
                    shownModes(),
                  )?.rival;

                  if (rival) {
                    props.onCompare(item, rival);
                  } else {
                    props.onSelect(item);
                  }
                }}
                onMouseEnter={(event) =>
                  preview(
                    item,
                    event.currentTarget,
                    undefined,
                    verdictFor(item, props.stores, shownModes()),
                  )
                }
                onMouseLeave={() => dismiss(item)}
              >
                <ItemIcon item={item} />
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{item.name}</span>
                  <span class="block truncate text-xs text-muted-foreground">
                    {typeName(item)}
                    <Show when={item.power > 0}> · {item.power}</Show>
                  </span>
                  <span class="block truncate text-xs text-muted-foreground">
                    <RollVerdict item={item} stores={props.stores} />
                  </span>
                </span>
              </button>
            </li>
          )}
        </For>
      </ul>
    </Show>
  </div>
);
