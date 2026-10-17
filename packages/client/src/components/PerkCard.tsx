import type { DimItem, DimPlug } from "app/inventory/item-types";
import { isEnhancedPerk } from "app/utils/socket-utils";
import { createMemo, Show } from "solid-js";

import { benefitFor, iconOf } from "../core/items/perks.ts";
import { GoldBadge } from "./card/GoldBadge.tsx";
import { PerkRow } from "./card/PerkRow.tsx";
import { AnchoredPanel } from "./lib/AnchoredPanel.tsx";

interface Props {
  item: DimItem;
  plug: DimPlug;
  beside: boolean;
}

export const PerkCard = (props: Props) => {
  const benefit = createMemo(() => benefitFor(props.item, props.plug));
  const enhanced = () => isEnhancedPerk(props.plug.plugDef);

  return (
    <AnchoredPanel
      class={`item-tooltip perk-card${props.beside ? " beside" : ""}`}
    >
      <div class="tooltip-body">
        <PerkRow
          icon={iconOf(props.plug.plugDef.displayProperties)}
          enhanced={enhanced()}
          badged
          name={
            <>
              {props.plug.plugDef.displayProperties.name}
              <Show when={enhanced()}>
                <GoldBadge>Enhanced</GoldBadge>
              </Show>
            </>
          }
          stats={benefit()?.stats}
          description={benefit()?.description}
        />
      </div>
    </AnchoredPanel>
  );
};
