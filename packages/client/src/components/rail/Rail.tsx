import { Show } from "solid-js";

import { useApp } from "../../App.tsx";
import { railCollapsed } from "../../core/rail.ts";
import { Compare } from "../Compare.tsx";
import { ItemMenu } from "../ItemMenu.tsx";
import { Arrivals } from "./Arrivals.tsx";
import { CurrentActivity } from "./CurrentActivity.tsx";
import { SelectionPanel } from "./SelectionPanel.tsx";

/** The panel docked at the right edge, under the header */
export const RAIL =
  "rail fixed top-(--header-h,49px) right-(--scrollbar-width,0px) bottom-0 z-2 flex w-(--rail) flex-col border-l bg-card [anchor-name:--rail] data-wide:w-(--rail-compare) data-floating:shadow-[-8px_0_24px_#000c]";

export const Rail = () => {
  const app = useApp();

  const floating = () => railCollapsed() && app.selected().length > 0;
  const railed = () => !railCollapsed() || app.selected().length > 0;

  return (
    <Show when={railed()}>
      <aside
        class={RAIL}
        data-rail
        data-wide={app.pinned().length > 1 ? "" : undefined}
        data-floating={floating() ? "" : undefined}
      >
        <Show
          when={app.pinned().length > 0}
          fallback={
            <Show
              when={app.selected().length === 0}
              fallback={
                <SelectionPanel
                  items={app.selected()}
                  stores={app.stores()}
                  active={app.active()}
                  moving={app.moving()}
                  onMoveMany={app.onMoveMany}
                  onClear={app.onClearSelection}
                />
              }
            >
              <Show
                when={!app.awaitingPins()}
                fallback={<p class="p-4 text-muted-foreground">Loading</p>}
              >
                <CurrentActivity />
                <ItemMenu
                  find={(index) =>
                    app.feed().find((one) => one.index === index)
                  }
                >
                  <Arrivals
                    items={app.feed()}
                    stores={app.stores()}
                    onSelect={app.onPin}
                    onCompare={app.onCompare}
                  />
                </ItemMenu>
              </Show>
            </Show>
          }
        >
          <Compare
            items={app.pinned()}
            stores={app.stores()}
            active={app.active()}
            onMove={app.onMove}
            onPrefer={app.onCharacter}
            onUnpin={app.onUnpin}
            moving={app.moving()}
          />
        </Show>
      </aside>
    </Show>
  );
};
