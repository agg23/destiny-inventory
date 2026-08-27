import type { DimItem, DimPlug } from "app/inventory/item-types";
import { isEnhancedPerk } from "app/utils/socket-utils";
import { createMemo, Show } from "solid-js";

import { Changes, PerkIcon } from "./ItemPanel.tsx";
import { benefitFor } from "./perks.ts";
import { AnchoredPanel } from "./ui/AnchoredPanel.tsx";

interface Props {
  item: DimItem;
  plug: DimPlug;
}

export const PerkCard = (props: Props) => {
  const benefit = createMemo(() => benefitFor(props.item, props.plug));
  const enhanced = () => isEnhancedPerk(props.plug.plugDef);

  const shown = () => {
    const { icon, hasIcon, name } = props.plug.plugDef.displayProperties;

    return { name, icon: hasIcon ? icon : undefined };
  };

  return (
    <AnchoredPanel class="item-tooltip perk-card">
      <div class="tooltip-body">
        <div class="tooltip-perk items-start">
          <PerkIcon icon={shown().icon} enhanced={enhanced()} />
          <div class="perk-text">
            <b classList={{ "text-light": enhanced() }}>
              {shown().name}
              <Show when={enhanced()}>
                {" "}
                <span class="tag">Enhanced</span>
              </Show>
            </b>
            <Show when={benefit()}>
              {(found) => (
                <>
                  <Changes stats={found().stats} />
                  <Show when={found().description}>
                    <span class="block whitespace-pre-wrap">
                      {found().description}
                    </span>
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
