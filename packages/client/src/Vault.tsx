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
            selected={app.selected()}
            isSelected={app.isSelected}
            onSelectStore={app.onCharacter}
            onSelect={app.onPin}
            onToggle={app.onToggle}
            onExtend={app.onExtend}
            onSelectMany={app.onSelectMany}
            onCollect={app.onCollect}
            moving={app.moving()}
          />
        )}
      </Show>

      <Rail />
    </>
  );
};
