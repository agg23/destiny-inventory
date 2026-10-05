import { For, Show } from "solid-js";

import { BUNGIE } from "./bungie.ts";
import type { AegisSetBonus, Mode, Tier } from "./rolls.ts";
import { settings, shownModes } from "./settings.ts";

const STRONG = new Set<Tier>(["S", "A", "B"]);

/** Both of a set's bonus tiers, 2 piece first, or undefined unless the sheet rates both */
export const setTiers = (bonuses: AegisSetBonus[]): Tier[] | undefined =>
  bonuses.length > 0 && bonuses.every((bonus) => bonus.tier)
    ? bonuses.map((bonus) => bonus.tier!)
    : undefined;

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

/** Rating chips: the main mode, then the second mode when it rates B or better */
export const TileRatings = (props: {
  tiers: (mode: Mode) => Tier[] | undefined;
}) => {
  const ratings = () => {
    const [main, second] = shownModes();
    const top = main ? props.tiers(main) : undefined;
    const other = second ? props.tiers(second) : undefined;
    const lower = other?.some((tier) => STRONG.has(tier)) ? other : undefined;

    if (top === undefined && lower === undefined) {
      return undefined;
    }

    return { top, lower };
  };

  return (
    <Show when={ratings()}>
      {(found) => (
        <span class="tile-ratings">
          <RatingRow tiers={found().top} />
          <Show when={found().lower}>
            {(lower) => <RatingRow tiers={lower()} />}
          </Show>
        </span>
      )}
    </Show>
  );
};

export interface TileProps {
  name: string;
  icon: string;
  overlay: string | undefined;
  rarity: string;
  /** State classes such as equipped, selected, or owned */
  classes: string[];
  index?: string;
  gearTier: number;
  corner: number | undefined;
  cornerClass?: string;
  tagColor: string | undefined;
  /** Element, breaker, and damage type icon paths */
  icons: (string | undefined)[];
  tiers: (mode: Mode) => Tier[] | undefined;
  catalyst?: { progress: number; complete: boolean };
  badges?: boolean;
  onClick?: (event: MouseEvent) => void;
  onEnter?: (element: HTMLElement) => void;
  onLeave?: () => void;
}

const tileClass = (props: TileProps): string =>
  ["item-tile small", props.rarity.toLowerCase(), ...props.classes]
    .filter((part) => part.length > 0)
    .join(" ");

const Face = (props: TileProps) => (
  <>
    <img src={`${BUNGIE}${props.icon}`} loading="lazy" alt="" />
    <span class="tile-edge" />
    <Show when={props.badges !== false}>
      <Show when={settings().overlay && props.overlay}>
        {(overlay) => (
          <img
            class="overlay"
            src={`${BUNGIE}${overlay()}`}
            loading="lazy"
            alt=""
          />
        )}
      </Show>
      <Show when={props.gearTier > 0}>
        <span class="gear-tier">{props.gearTier}</span>
      </Show>
      <Show when={props.corner}>
        {(value) => (
          <span class={`item-quantity ${props.cornerClass ?? ""}`}>
            {value()}
          </span>
        )}
      </Show>
      <span class="tile-icons">
        <Show when={props.tagColor}>
          {(color) => (
            <span
              class="tag-dot"
              style={{ "background-color": `var(--color-${color()})` }}
            />
          )}
        </Show>
        <For each={props.icons}>
          {(icon) => (
            <Show when={icon}>
              {(path) => <img src={`${BUNGIE}${path()}`} alt="" />}
            </Show>
          )}
        </For>
      </span>
      <TileRatings tiers={props.tiers} />
      <Show when={props.catalyst}>
        {(catalyst) => (
          <span
            class="catalyst-bar"
            classList={{ complete: catalyst().complete }}
          >
            <span style={{ width: `${catalyst().progress * 100}%` }} />
          </span>
        )}
      </Show>
    </Show>
  </>
);

/** The grid square for an item in every view. A button when it takes clicks */
export const Tile = (props: TileProps) => (
  <Show
    when={props.onClick}
    fallback={
      <span
        class={tileClass(props)}
        aria-label={props.name}
        data-item-index={props.index}
      >
        <Face {...props} />
      </span>
    }
  >
    {(onClick) => (
      <button
        type="button"
        class={tileClass(props)}
        aria-label={props.name}
        data-item-index={props.index}
        onClick={(e) => onClick()(e)}
        onMouseEnter={(e) => props.onEnter?.(e.currentTarget)}
        onMouseLeave={() => props.onLeave?.()}
      >
        <Face {...props} />
      </button>
    )}
  </Show>
);
