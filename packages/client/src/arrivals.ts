import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";

const PADDING = 20;
const SHOWN = 10;

// Instance ids ascend with acquisition
const recency = (item: DimItem) => item.id.padStart(PADDING, "0");

// Stacks all share the id "0"
const dropped = (item: DimItem) => item.id !== "0" && item.equipment;

export const acquired = (stores: DimStore[]): DimItem[] =>
  stores
    .flatMap((store) => store.items)
    .filter(dropped)
    .sort((a, b) => (recency(a) < recency(b) ? 1 : -1))
    .slice(0, SHOWN);

// Power against the best of the same slot already held
export const powerDelta = (
  item: DimItem,
  stores: DimStore[],
): number | undefined => {
  if (item.power <= 0) {
    return undefined;
  }

  const rivals = stores
    .flatMap((store) => store.items)
    .filter(
      (other) => other.id !== item.id && other.bucket.hash === item.bucket.hash,
    )
    .map((other) => other.power);

  if (rivals.length === 0) {
    return undefined;
  }

  return item.power - Math.max(...rivals);
};
