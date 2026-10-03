import { Show } from "solid-js";

import { BUNGIE } from "../../bungie.ts";
import type { Catalyst, Entry, Ownership } from "../../collections.ts";
import { defs } from "../../defs.ts";
import { ratingFor } from "../../rolls.ts";
import { settings } from "../../settings.ts";

interface Props {
  entry: Entry;
  ownership: Ownership | undefined;
  copies: number;
  catalyst: Catalyst | undefined;
  onOpen: () => void;
  onEnter: (element: HTMLElement) => void;
  onLeave: () => void;
}

export const damageIcon = (entry: Entry): string | undefined =>
  entry.kind === "armor" || entry.damageTypeHash === undefined
    ? undefined
    : defs()?.DamageType.getOptional(entry.damageTypeHash)?.displayProperties
        .icon;

/** Best Aegis tier across every version */
export const weaponTier = (entry: Entry): string | undefined => {
  if (entry.kind === "armor") {
    return undefined;
  }

  for (const hash of entry.itemHashes) {
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
    class={`item-tile small ${props.entry.rarity.toLowerCase()} ${
      props.ownership ?? ""
    }`}
    aria-label={props.entry.name}
    onClick={() => props.onOpen()}
    onMouseEnter={(e) => props.onEnter(e.currentTarget)}
    onMouseLeave={() => props.onLeave()}
  >
    <img src={`${BUNGIE}${props.entry.icon}`} loading="lazy" alt="" />
    <span class="tile-edge" />
    <Show when={settings().overlay && props.entry.watermark}>
      {(watermark) => (
        <img
          class="overlay"
          src={`${BUNGIE}${watermark()}`}
          loading="lazy"
          alt=""
        />
      )}
    </Show>
    <Show when={weaponTier(props.entry)}>
      {(tier) => (
        <span class={`item-tier tier-${tier().toLowerCase()}`}>{tier()}</span>
      )}
    </Show>
    <Show when={props.copies > 0}>
      <span class="item-quantity owned-count">{props.copies}</span>
    </Show>
    <span class="tile-icons">
      <Show when={damageIcon(props.entry)}>
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
