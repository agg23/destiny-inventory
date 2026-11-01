import type { DimItem } from "app/inventory/item-types";

import { isFavorite, setFavorite, tagTarget } from "../../core/items/tags.ts";
import { IconButton } from "../lib/IconButton.tsx";
import { Heart } from "../lib/zaidan/icons.tsx";

/** The heart toggle, favoriting every item it is given */
export const FavoriteControl = (props: { items: DimItem[] }) => {
  const all = () =>
    props.items.length > 0 && props.items.every((item) => isFavorite(item.id));

  return (
    <IconButton
      type="button"
      size="icon-xs"
      label={all() ? "Unfavorite" : "Favorite"}
      aria-pressed={all()}
      onClick={() => setFavorite(props.items.map(tagTarget), !all())}
    >
      <Heart filled={all()} />
    </IconButton>
  );
};
