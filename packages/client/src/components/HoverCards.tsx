import type { DimItem } from "app/inventory/item-types";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";

import { catalystForItem } from "../core/collections/ownership.ts";
import { rivalFor } from "../core/items/compare.ts";
import { previewedPerk } from "../core/items/perkPreview.ts";
import { previewed } from "../core/items/preview.ts";
import type { LoadResult } from "../core/profile/loadTypes.ts";
import { HoverCard } from "./HoverCard.tsx";
import { PerkCard } from "./PerkCard.tsx";

interface Props {
  pinned: DimItem[];
  records: LoadResult["records"];
}

export const HoverCards = (props: Props) => {
  const against = () => rivalFor(props.pinned, previewed()?.item);

  return (
    <>
      {/* An anchor must come earlier in the page than its card */}
      <Show when={previewed()}>
        {(card) => (
          <Portal>
            <HoverCard
              item={card().item}
              against={against()}
              verdict={card().verdict}
              cursorX={card().cursorX}
              rollWarning={card().rollWarning}
              notes={card().notes}
              cost={card().cost}
              catalyst={catalystForItem(card().item.hash, props.records)}
            />
          </Portal>
        )}
      </Show>

      <Show when={previewedPerk()}>
        {(card) => (
          <Portal>
            <PerkCard
              item={card().item}
              plug={card().plug}
              beside={card().beside}
            />
          </Portal>
        )}
      </Show>
    </>
  );
};
