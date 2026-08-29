import { Show } from "solid-js";

import { useApp } from "./App.tsx";
import { Arrivals } from "./Arrivals.tsx";
import { PageChrome } from "./chrome.tsx";
import { Compare } from "./Compare.tsx";
import { Inventory } from "./Inventory.tsx";
import { railCollapsed } from "./rail.ts";

export const Vault = () => {
  const app = useApp();

  const floating = () => railCollapsed() && app.pinned().length > 0;
  const railed = () => !railCollapsed() || app.pinned().length > 0;

  return (
    <>
      <PageChrome
        status={
          <Show when={app.loaded()}>
            {(loaded) => (
              <span>
                {app.shown()} of {loaded().items.length} items
                <Show when={loaded().counts.hidden > 0}>
                  {" "}
                  · {loaded().counts.hidden} hidden
                </Show>
                <Show when={loaded().counts.skipped > 0}>
                  {" "}
                  · {loaded().counts.skipped} skipped
                </Show>
              </span>
            )}
          </Show>
        }
      />

      <Show when={app.loaded()}>
        {(loaded) => (
          <Inventory
            stores={app.stores()}
            buckets={loaded().buckets}
            matched={app.matched()}
            active={app.active()}
            pinned={app.pinned()}
            onSelectStore={app.onCharacter}
            onSelect={app.onPin}
            onCollect={app.onCollect}
            onMove={app.onMove}
            onUnpin={app.onUnpin}
            onCompare={app.onCompare}
            onQuery={app.onQuery}
            moving={app.moving()}
          />
        )}
      </Show>

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
    </>
  );
};
