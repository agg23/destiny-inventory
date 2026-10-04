import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { BUNGIE } from "./bungie.ts";
import { dismiss, preview } from "./preview.ts";
import { assess, setRatings, type Mode, type Tier } from "./rolls.ts";
import { settings, shownModes } from "./settings.ts";
import { tagFor } from "./tags.ts";

interface Props {
  item: DimItem;
  selected?: boolean;
  onSelect?: (item: DimItem, event: MouseEvent) => void;
  badges?: boolean;
  class?: string;
}

// The framework's power slot hangs below the tile
const corner = (item: DimItem): number | undefined => {
  if (item.power > 0) {
    return item.power;
  }

  return item.amount > 1 ? item.amount : undefined;
};

const STRONG = new Set<Tier>(["S", "A", "B"]);

const ratingChips = (item: DimItem, mode: Mode): Tier[] | undefined => {
  const overall = assess(item, mode)?.overall;

  if (overall) {
    return [overall];
  }

  const bonuses = setRatings(item, mode);

  return bonuses.length > 0 && bonuses.every((bonus) => bonus.tier)
    ? bonuses.map((bonus) => bonus.tier!)
    : undefined;
};

const tileRatings = (
  item: DimItem,
): { top: Tier[] | undefined; lower: Tier[] | undefined } | undefined => {
  const [main, second] = shownModes();
  const top = main ? ratingChips(item, main) : undefined;
  const other = second ? ratingChips(item, second) : undefined;
  const lower = other?.some((tier) => STRONG.has(tier)) ? other : undefined;

  if (top === undefined && lower === undefined) {
    return undefined;
  }

  return { top, lower };
};

const RatingRow = (props: { tiers: Tier[] | undefined }) => (
  <Show when={props.tiers} fallback={<span class="item-tier unrated">?</span>}>
    {(tiers) => (
      <Show
        when={tiers().length > 1}
        fallback={
          <span class={`item-tier tier-${tiers()[0]!.toLowerCase()}`}>
            {tiers()[0]}
          </span>
        }
      >
        <span class="item-tier set-tier">
          <For each={tiers()}>
            {(tier) => <span class={`tier-${tier.toLowerCase()}`}>{tier}</span>}
          </For>
        </span>
      </Show>
    )}
  </Show>
);

const tileClass = (props: Props): string =>
  [
    "item-tile small",
    props.item.rarity.toLowerCase(),
    props.item.equipped ? "equipped" : "",
    props.selected ? "selected" : "",
    props.class ?? "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

const Face = (props: Props) => (
  <>
    <img src={`${BUNGIE}${props.item.icon}`} loading="lazy" alt="" />
    <span class="tile-edge" />
    <Show when={props.badges !== false}>
      <Show when={settings().overlay && props.item.iconOverlay}>
        {(overlay) => (
          <img
            class="overlay"
            src={`${BUNGIE}${overlay()}`}
            loading="lazy"
            alt=""
          />
        )}
      </Show>
      <Show when={props.item.tier > 0}>
        <span class="gear-tier">{props.item.tier}</span>
      </Show>
      <Show when={corner(props.item)}>
        {(value) => <span class="item-quantity">{value()}</span>}
      </Show>
      <span class="tile-icons">
        <Show when={tagFor(props.item.id)}>
          {(def) => (
            <span
              class="tag-dot"
              style={{ "background-color": `var(--color-${def().color})` }}
            />
          )}
        </Show>
        <Show when={props.item.element?.displayProperties.icon}>
          {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
        </Show>
        <Show when={props.item.breakerType?.displayProperties.icon}>
          {(icon) => <img src={`${BUNGIE}${icon()}`} alt="" />}
        </Show>
      </span>
      <Show when={tileRatings(props.item)}>
        {(ratings) => (
          <span class="tile-ratings">
            <RatingRow tiers={ratings().top} />
            <Show when={ratings().lower}>
              {(lower) => <RatingRow tiers={lower()} />}
            </Show>
          </span>
        )}
      </Show>
    </Show>
  </>
);

export const ItemIcon = (props: Props) => (
  <Show
    when={props.onSelect}
    fallback={
      <span class={tileClass(props)} data-item-index={props.item.index}>
        <Face {...props} />
      </span>
    }
  >
    {(onSelect) => (
      <button
        type="button"
        class={tileClass(props)}
        data-item-index={props.item.index}
        onClick={(e) => onSelect()(props.item, e)}
        onMouseEnter={(e) => preview(props.item, e.currentTarget)}
        onMouseLeave={() => dismiss(props.item)}
      >
        <Face {...props} />
      </button>
    )}
  </Show>
);
