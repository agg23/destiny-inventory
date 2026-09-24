import { Show } from "solid-js";

import { useApp } from "./App.tsx";
import { PageChrome } from "./chrome.tsx";
import { Inventory } from "./Inventory.tsx";
import { Rail } from "./Rail.tsx";

export const Vault = () => {
  const app = useApp();

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

      <Rail />
    </>
  );
};
