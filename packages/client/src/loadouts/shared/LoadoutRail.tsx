import type { DimItem } from "app/inventory/item-types";
import { createMemo, createSignal, For, Show } from "solid-js";

import { PerkRow } from "../../components/card/PerkRow.tsx";
import { Compare } from "../../components/Compare.tsx";
import { LABEL } from "../../components/lib/text.ts";
import { ChevronRight } from "../../components/lib/zaidan/icons.tsx";
import { RAIL } from "../../components/rail/Rail.tsx";
import { clarityFor } from "../../core/items/clarity.ts";
import { dismissPerk, previewPerk } from "../../core/items/perkPreview.ts";
import { benefitFor } from "../../core/items/perks.ts";
import { railCollapsed } from "../../core/rail.ts";
import type { Modifier, SharedLoadout } from "./sharedLoadout.ts";

const ModifierRow = (props: { modifier: Modifier }) => {
  const benefit = createMemo(() =>
    benefitFor(props.modifier.item, props.modifier.plug),
  );

  return (
    <Show when={benefit()}>
      {(found) => (
        <PerkRow
          icon={found().icon}
          enhanced={found().enhanced}
          square
          name={
            props.modifier.count > 1
              ? `${found().name} ×${props.modifier.count}`
              : found().name
          }
          stats={found().stats}
          description={found().description}
          onMouseEnter={(event) => {
            if (clarityFor(props.modifier.plug.plugDef.hash)) {
              previewPerk(
                props.modifier.item,
                props.modifier.plug,
                event.currentTarget,
              );
            }
          }}
          onMouseLeave={() => dismissPerk(props.modifier.plug)}
        />
      )}
    </Show>
  );
};

const COLLAPSED_GROUPS = ["Super", "Abilities"];

export const LoadoutRail = (props: {
  shared: SharedLoadout;
  focused: DimItem | undefined;
  onClose: () => void;
}) => {
  const [collapsed, setCollapsed] = createSignal(new Set(COLLAPSED_GROUPS));

  const toggle = (title: string) =>
    setCollapsed((was) => {
      const next = new Set(was);

      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }

      return next;
    });

  return (
    <Show when={!railCollapsed() || props.focused}>
      <aside
        class={RAIL}
        data-rail
        data-floating={railCollapsed() && props.focused ? "" : undefined}
      >
        <Show
          when={props.focused}
          fallback={
            <div class="flex min-h-0 flex-col gap-2 overflow-y-auto p-4">
              <For each={props.shared.modifiers}>
                {(group) => {
                  const open = () => !collapsed().has(group.title);

                  return (
                    <section>
                      <h3 class={LABEL}>
                        <button
                          type="button"
                          class="flex h-6 w-full items-center gap-3 hover:text-foreground"
                          aria-expanded={open()}
                          onClick={() => toggle(group.title)}
                        >
                          {/* Same width as the row icons */}
                          <span class="flex w-8 flex-none justify-center">
                            <ChevronRight
                              class={`size-4 transition-transform ${open() ? "rotate-90" : ""}`}
                            />
                          </span>
                          {group.title}
                        </button>
                      </h3>
                      <Show when={open()}>
                        <div>
                          <For each={group.modifiers}>
                            {(modifier) => <ModifierRow modifier={modifier} />}
                          </For>
                        </div>
                      </Show>
                    </section>
                  );
                }}
              </For>
            </div>
          }
        >
          {(item) => (
            <Compare items={[item()]} onUnpin={props.onClose} hideMoves />
          )}
        </Show>
      </aside>
    </Show>
  );
};
