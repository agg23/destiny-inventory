import { Show } from "solid-js";

import { BUNGIE } from "../bungie.ts";
import type { Catalyst, Ownership, Weapon } from "../collections.ts";
import { defs } from "../defs.ts";
import { ratingFor } from "../rolls.ts";
import { settings } from "../settings.ts";

interface Props {
  weapon: Weapon;
  ownership: Ownership | undefined;
  copies: number;
  catalyst: Catalyst | undefined;
  onOpen: () => void;
  onEnter: (element: HTMLElement) => void;
  onLeave: () => void;
}

export const damageIcon = (weapon: Weapon): string | undefined =>
  weapon.damageTypeHash === undefined
    ? undefined
    : defs()?.DamageType.getOptional(weapon.damageTypeHash)?.displayProperties
        .icon;

/** Best Aegis tier across every version */
export const weaponTier = (weapon: Weapon): string | undefined => {
  for (const hash of weapon.itemHashes) {
    const tier = ratingFor(hash)?.tier;

    if (tier) {
      return tier;
    }
  }

  return undefined;
};

export const CollectionTile = (props: Props) => (
  <button
    type="button"
    class={`item-tile small ${props.weapon.rarity.toLowerCase()} ${
      props.ownership ?? ""
    }`}
    aria-label={props.weapon.name}
    onClick={() => props.onOpen()}
    onMouseEnter={(e) => props.onEnter(e.currentTarget)}
    onMouseLeave={() => props.onLeave()}
  >
    <img src={`${BUNGIE}${props.weapon.icon}`} loading="lazy" alt="" />
    <span class="tile-edge" />
    <Show when={settings().overlay && props.weapon.watermark}>
      {(watermark) => (
        <img
          class="overlay"
          src={`${BUNGIE}${watermark()}`}
          loading="lazy"
          alt=""
        />
      )}
    </Show>
    <Show when={weaponTier(props.weapon)}>
      {(tier) => (
        <span class={`item-tier tier-${tier().toLowerCase()}`}>{tier()}</span>
      )}
    </Show>
    <Show when={props.copies > 0}>
      <span class="item-quantity owned-count">{props.copies}</span>
    </Show>
    <span class="tile-icons">
      <Show when={damageIcon(props.weapon)}>
        {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
      </Show>
    </span>
    <Show when={props.catalyst?.unlocked}>
      <span
        class="catalyst-bar"
        classList={{ complete: props.catalyst?.complete }}
      >
        <span style={{ width: `${(props.catalyst?.progress ?? 0) * 100}%` }} />
      </span>
    </Show>
  </button>
);
