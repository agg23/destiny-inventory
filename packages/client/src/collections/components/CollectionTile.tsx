import type { Catalyst, Entry, Ownership } from "../../collections.ts";
import { defs } from "../../defs.ts";
import { ratingFor, setBonusFor, type Mode, type Tier } from "../../rolls.ts";
import { setTiers, Tile } from "../../Tile.tsx";

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

/** A weapon's tier from the first version the sheet rates, or an armor set's two bonus tiers */
export const entryTiers = (entry: Entry, mode: Mode): Tier[] | undefined => {
  if (entry.kind === "weapon") {
    for (const hash of entry.itemHashes) {
      const tier = ratingFor(hash, mode)?.tier;

      if (tier) {
        return [tier];
      }
    }

    return undefined;
  }

  const set =
    entry.itemSetHash === undefined
      ? undefined
      : defs()?.EquipableItemSet.getOptional(entry.itemSetHash);
  const bonuses = (set?.setPerks ?? [])
    .flatMap((perk) => {
      const found = setBonusFor(perk.sandboxPerkHash, mode);

      return found ? [found] : [];
    })
    .sort((a, b) => a.pieces - b.pieces);

  return setTiers(bonuses);
};

export const CollectionTile = (props: Props) => (
  <Tile
    name={props.entry.name}
    icon={props.entry.icon}
    overlay={props.entry.watermark}
    rarity={props.entry.rarity}
    classes={[props.ownership ?? ""]}
    gearTier={0}
    corner={props.copies > 0 ? props.copies : undefined}
    cornerClass="owned-count"
    tagColor={undefined}
    icons={[damageIcon(props.entry)]}
    tiers={(mode) => entryTiers(props.entry, mode)}
    catalyst={props.catalyst?.unlocked ? props.catalyst : undefined}
    onClick={() => props.onOpen()}
    onEnter={props.onEnter}
    onLeave={props.onLeave}
  />
);
