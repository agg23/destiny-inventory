import { Show } from "solid-js";

import { useApp } from "./App.tsx";
import { Arrivals } from "./Arrivals.tsx";
import { Compare } from "./Compare.tsx";
import { railCollapsed } from "./rail.ts";

export const Rail = () => {
  const app = useApp();

  const floating = () => railCollapsed() && app.pinned().length > 0;
  const railed = () => !railCollapsed() || app.pinned().length > 0;

  return (
    <Show when={railed()}>
      <aside
        class="rail"
        classList={{
          comparing: app.pinned().length > 1,
          floating: floating(),
        }}
      >
        <Show
          when={app.pinned().length > 0}
          fallback={
            <Show
              when={!app.awaitingPins()}
              fallback={<p class="p-3 text-muted">Loading</p>}
            >
              <Arrivals
                items={app.feed()}
                stores={app.stores()}
                onSelect={app.onPin}
                onCompare={app.onCompare}
              />
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
