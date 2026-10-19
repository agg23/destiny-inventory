import type { DimItem, DimPlug } from "app/inventory/item-types";
import { isEnhancedPerk } from "app/utils/socket-utils";
import { createMemo, Show } from "solid-js";

import { clarityFor } from "../core/items/clarity.ts";
import { benefitFor, iconOf } from "../core/items/perks.ts";
import { ClarityText } from "./card/ClarityText.tsx";
import { GoldBadge } from "./card/GoldBadge.tsx";
import { PerkRow } from "./card/PerkRow.tsx";
import { AnchoredPanel } from "./lib/AnchoredPanel.tsx";
import { FlaskGlyph } from "./lib/FlaskGlyph.tsx";

interface Props {
  item: DimItem;
  plug: DimPlug;
  beside: boolean;
}

export const PerkCard = (props: Props) => {
  const benefit = createMemo(() => benefitFor(props.item, props.plug));
  const enhanced = () => isEnhancedPerk(props.plug.plugDef);
  const clarity = createMemo(() => clarityFor(props.plug.plugDef.hash));

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
          description={clarity() ? undefined : benefit()?.description}
        >
          <Show when={clarity()}>
            {(lines) => <ClarityText lines={lines()} />}
          </Show>
        </PerkRow>
      </div>
      <Show when={clarity()}>
        <div class="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <FlaskGlyph class="size-3.5" />
          Data from Clarity
        </div>
      </Show>
    </AnchoredPanel>
  );
};
