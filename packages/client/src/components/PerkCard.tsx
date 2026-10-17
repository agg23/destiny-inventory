import type { DimItem, DimPlug } from "app/inventory/item-types";
import { isEnhancedPerk } from "app/utils/socket-utils";
import { createMemo, Show } from "solid-js";

import { benefitFor } from "../core/items/perks.ts";
import {
  GOLD_BADGE,
  PERK,
  PERK_TITLE,
  PERK_TEXT,
  PerkIcon,
} from "./card/PerkDetails.tsx";
import { Changes } from "./card/Stats.tsx";
import { AnchoredPanel } from "./lib/AnchoredPanel.tsx";
import { Badge } from "./lib/zaidan/badge.tsx";

interface Props {
  item: DimItem;
  plug: DimPlug;
  beside: boolean;
}

export const PerkCard = (props: Props) => {
  const benefit = createMemo(() => benefitFor(props.item, props.plug));
  const enhanced = () => isEnhancedPerk(props.plug.plugDef);

  const shown = () => {
    const { icon, hasIcon, name } = props.plug.plugDef.displayProperties;

    return { name, icon: hasIcon ? icon : undefined };
  };

  return (
    <AnchoredPanel
      class={`item-tooltip perk-card${props.beside ? " beside" : ""}`}
    >
      <div class="tooltip-body">
        <div class={PERK}>
          <PerkIcon icon={shown().icon} enhanced={enhanced()} />
          <div class="min-w-0">
            <b
              class={PERK_TITLE}
              classList={{ "text-light!": enhanced() }}
            >
              {shown().name}
              <Show when={enhanced()}>
                <Badge variant="outline" class={GOLD_BADGE}>
                  Enhanced
                </Badge>
              </Show>
            </b>
            <Show when={benefit()}>
              {(found) => (
                <>
                  <Changes stats={found().stats} />
                  <Show when={found().description}>
                    <span class={PERK_TEXT}>{found().description}</span>
                  </Show>
                </>
              )}
            </Show>
          </div>
        </div>
      </div>
    </AnchoredPanel>
  );
};
