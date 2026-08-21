import type { DimItem } from "app/inventory/item-types";
import { createSignal, onCleanup, Show } from "solid-js";

import { useApp } from "./App.tsx";
import { Arrivals } from "./Arrivals.tsx";
import { comparable } from "./compare.ts";
import { Compare } from "./Compare.tsx";
import { HoverCard } from "./HoverCard.tsx";
import { Inventory } from "./Inventory.tsx";

const HOVER_DELAY = 120;

interface Hovered {
  item: DimItem;
  anchor: DOMRect;
}

export const Vault = () => {
  const app = useApp();
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);

  let hoverTimer: number | undefined = undefined;

  onCleanup(() => window.clearTimeout(hoverTimer));

  const onHover = (item: DimItem, anchor: DOMRect) => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(
      () => setHovered({ item, anchor }),
      HOVER_DELAY,
    );
  };

  const onLeave = (item: DimItem) => {
    window.clearTimeout(hoverTimer);

    if (hovered()?.item.id === item.id) {
      setHovered(undefined);
    }
  };

  const against = () => {
    const [reference] = app.pinned();
    const item = hovered()?.item;

    if (!reference || !item || reference.id === item.id) {
      return undefined;
    }

    return comparable(reference, item) ? reference : undefined;
  };

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
            onHover={onHover}
            onLeave={onLeave}
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

      <Show when={hovered()}>
        {(card) => (
          <HoverCard
            item={card().item}
            against={against()}
            anchor={card().anchor}
          />
        )}
      </Show>
    </>
  );
};
