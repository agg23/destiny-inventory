import { Show } from "solid-js";

import { useApp } from "./App.tsx";
import { Arrivals } from "./Arrivals.tsx";
import { Compare } from "./Compare.tsx";
import { Inventory } from "./Inventory.tsx";

export const Vault = () => {
  const app = useApp();

  return (
    <>
      <Show when={app.loaded()}>
        {(loaded) => (
          <Inventory
            stores={app.stores()}
            buckets={loaded().buckets}
            matches={app.matches}
            active={app.active()}
            pinned={app.pinned()}
            onSelectStore={app.onCharacter}
            onSelect={app.onPin}
          />
        )}
      </Show>

      <aside class="rail" classList={{ comparing: app.pinned().length > 1 }}>
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
            onUnpin={app.onPin}
            moving={app.moving()}
            moveError={app.moveError()}
          />
        </Show>
      </aside>
    </>
  );
};
