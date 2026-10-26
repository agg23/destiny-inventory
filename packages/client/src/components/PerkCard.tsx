import type { DimItem, DimPlug } from "app/inventory/item-types";
import { isEnhancedPerk } from "app/utils/socket-utils";
import { createMemo, Show } from "solid-js";

import { clarityFor } from "../core/items/clarity.ts";
import { benefitFor, iconOf } from "../core/items/perks.ts";
import { perkFor, perksRanked } from "../core/items/rolls.ts";
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
  const aegis = () => perkFor(props.plug.plugDef.hash);

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
      <Show when={clarity()}>
        {(lines) => (
          <div class="tooltip-body">
            <div class="py-1.5 pl-11">
              <ClarityText lines={lines()} />
            </div>
          </div>
        )}
      </Show>
      <Show when={clarity() || aegis()?.rank}>
        <div class="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <Show when={clarity()}>
            <FlaskGlyph class="size-3.5" />
            Data from Clarity
          </Show>
          <Show when={aegis()}>
            {(perk) => (
              <Show when={perk().rank}>
                {(rank) => (
                  <span class="ml-auto tabular-nums">
                    Aegis rating #{rank()} of {perksRanked(perk().kind)}
                  </span>
                )}
              </Show>
            )}
          </Show>
        </div>
      </Show>
    </AnchoredPanel>
  );
};
