import { Show } from "solid-js";

import { useApp } from "./App.tsx";
import { Inventory } from "./Inventory.tsx";
import { Rail } from "./Rail.tsx";

export const Vault = () => {
  const app = useApp();

  return (
    <>
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
            moving={app.moving()}
          />
        )}
      </Show>

      <Rail />
    </>
  );
};
