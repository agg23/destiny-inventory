import type { DimItem } from "app/inventory/item-types";
import ammoHeavy from "destiny-icons/general/ammo-heavy.svg?inline";
import ammoPrimary from "destiny-icons/general/ammo-primary.svg?inline";
import ammoSpecial from "destiny-icons/general/ammo-special.svg?inline";
import { A } from "@solidjs/router";
import { Show } from "solid-js";

import type { CardCost } from "../../core/items/preview.ts";
import { itemEntryHref, lightGgHref } from "../../core/url.ts";
import { BungieImage } from "../BungieImage.tsx";
import { CollectionsGlyph } from "../lib/CollectionsGlyph.tsx";
import { ExternalGlyph } from "../lib/ExternalGlyph.tsx";
import { TagControl } from "./TagControl.tsx";

// DestinyClass Titan, Hunter and Warlock
const CLASSES = new Set([0, 1, 2]);

// "Helmet" alone does not say which class
export const typeName = (item: DimItem): string => {
  const owner = item.classTypeNameLocalized;

  if (!CLASSES.has(item.classType) || item.typeName.startsWith(owner)) {
    return item.typeName;
  }

  return `${owner} ${item.typeName}`;
};

export const ItemHead = (props: {
  item: DimItem;
  compact?: boolean;
  taggable?: boolean;
  /** Collections and light.gg links */
  links?: boolean;
  notes?: string[];
  cost?: CardCost;
}) => (
  <>
    <div
      class={`tooltip-header ${props.item.rarity.toLowerCase()}`}
      classList={{ "h-(--item-head) p-0": props.compact }}
    >
      <div class="flex h-full items-stretch gap-2">
        <Show when={props.compact}>
          <BungieImage
            path={props.item.icon}
            class="aspect-square h-full shrink-0"
          />
        </Show>
        <div
          class="min-w-0 flex-1"
          classList={{ "flex flex-col justify-center pr-4": props.compact }}
        >
          <div
            class="tooltip-name"
            classList={{
              "line-clamp-2 pr-6 text-sm leading-5 whitespace-normal":
                props.compact,
            }}
          >
            {props.item.name}
          </div>
          <div class="tooltip-type">
            <span class="truncate">{typeName(props.item)}</span>
            <Show when={props.item.tier > 0}>
              <span class="gear-tier">Tier {props.item.tier}</span>
            </Show>
          </div>
        </div>
      </div>
    </div>
    <div
      class="py-2 empty:hidden"
      classList={{
        "tooltip-body": !props.compact,
        "border-b": props.compact,
      }}
    >
      <ItemPower
        item={props.item}
        taggable={props.taggable}
        links={props.links}
        notes={props.notes}
        cost={props.cost}
      />
    </div>
  </>
);

// DestinyAmmunitionType
const AMMO: Record<number, { url: string; name: string }> = {
  1: { url: ammoPrimary, name: "Primary" },
  2: { url: ammoSpecial, name: "Special" },
  3: { url: ammoHeavy, name: "Heavy" },
};

const ItemLinks = (props: { item: DimItem }) => (
  <span class="item-links">
    <A
      href={itemEntryHref(props.item)}
      title="Show in Collections"
      aria-label="Show in Collections"
    >
      <CollectionsGlyph />
    </A>
    <a
      href={lightGgHref(props.item.hash)}
      target="_blank"
      rel="noreferrer"
      title="Show on light.gg"
      aria-label="Show on light.gg"
    >
      <ExternalGlyph />
    </a>
  </span>
);

const ItemPower = (props: {
  item: DimItem;
  taggable?: boolean;
  links?: boolean;
  notes?: string[];
  cost?: CardCost;
}) => {
  const armor = () => props.item.bucket.inArmor;
  const notes = () => props.notes ?? [];
  const linked = () =>
    !!props.links && (props.item.bucket.inWeapons || armor());

  return (
    <Show
      when={
        props.item.power > 0 ||
        props.item.element ||
        props.item.energy ||
        props.item.breakerType ||
        linked() ||
        (props.taggable && props.item.id !== "0") ||
        notes().length > 0 ||
        props.cost
      }
    >
      <div class="tooltip-power">
        <span class="power-facts">
          <Show when={props.item.power > 0}>
            <span class="power-value">{props.item.power}</span>
          </Show>
          <Show when={!armor() && AMMO[props.item.ammoType]}>
            {(ammo) => (
              <img
                class="ammo-icon"
                src={ammo().url}
                alt=""
                title={ammo().name}
              />
            )}
          </Show>
          <BungieImage
            path={!armor() && props.item.element?.displayProperties.icon}
            class="element-icon"
            title={props.item.element?.displayProperties.name}
          />
          <BungieImage
            path={props.item.breakerType?.displayProperties.icon}
            class="breaker-icon"
            title={props.item.breakerType?.displayProperties.name}
          />
          <Show when={props.cost}>
            {(cost) => (
              <span class="power-type">
                <BungieImage path={cost().icon} class="cost-icon" />
                {cost().quantity.toLocaleString()}
              </span>
            )}
          </Show>
          <Show when={armor() && props.item.energy}>
            {(energy) => (
              <span class="power-type">
                Energy {energy().energyUsed}/{energy().energyCapacity}
              </span>
            )}
          </Show>
        </span>
        <Show when={linked()}>
          <ItemLinks item={props.item} />
        </Show>
        <Show when={props.taggable && props.item.id !== "0"}>
          <TagControl items={[props.item]} />
        </Show>
        <Show when={notes().length > 0}>
          <span class="power-notes">{notes().join(" · ")}</span>
        </Show>
      </div>
    </Show>
  );
};
