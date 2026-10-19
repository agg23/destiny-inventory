import type { DimItem } from "app/inventory/item-types";
import { getItemDamageShortName } from "app/utils/item-utils";

export type Dash = "solid" | "dashed" | "dotted";

const DASHES: Dash[] = ["solid", "dashed", "dotted"];

/** SVG dasharray for each dash, matching what echarts draws */
export const DASH_ARRAY: Record<Dash, string | undefined> = {
  solid: undefined,
  dashed: "5 3",
  dotted: "1.5 2.5",
};

export interface WeaponLine {
  instanceId: string;
  itemHash: number;
  // CSS, see canvasColor
  color: string;
  dash: Dash;
}

/** The weapon's damage type color, with a dash to tell same element weapons apart */
export const weaponLinesOf = <
  T extends { instanceId: string; itemHash: number },
>(
  weapons: T[],
  itemOf: (weapon: T) => DimItem | undefined,
): WeaponLine[] => {
  const used = new Map<string, number>();

  return weapons.map((weapon) => {
    const item = itemOf(weapon);
    const name = item ? getItemDamageShortName(item) : undefined;
    // Raid damage has no color of its own
    const element = name === undefined || name === "raid" ? "kinetic" : name;
    const index = used.get(element) ?? 0;

    used.set(element, index + 1);

    return {
      instanceId: weapon.instanceId,
      itemHash: weapon.itemHash,
      color: `var(--color-${element})`,
      dash: DASHES[index % DASHES.length]!,
    };
  });
};

const resolved = new Map<string, string>();

/** A CSS color as canvas can draw it, since canvas reads no custom properties */
export const canvasColor = (css: string): string => {
  const held = resolved.get(css);

  if (held) {
    return held;
  }

  const probe = document.createElement("span");
  probe.style.color = css;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  resolved.set(css, value);

  return value;
};
