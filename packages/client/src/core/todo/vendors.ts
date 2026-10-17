import type { DimItem } from "app/inventory/item-types";
import type {
  DestinyVendorSaleItemComponent,
  DestinyVendorsResponse,
} from "bungie-api-ts/destiny2";
import { VendorItemStatus } from "bungie-api-ts/destiny2";

import type { SlimVendor } from "@dvm/defs-core";

import { defs } from "../profile/defs.ts";
import { nextWeekendReset, nextWeeklyReset, xurPresent } from "./reset.ts";
import type {
  Cost,
  Offer,
  Priority,
  RankReset,
  RotationItem,
  Slot,
  VendorItems,
  VendorState,
  Watch,
} from "./vendorTypes.ts";
import {
  ARMOR_ORNAMENTS,
  PRIORITY,
  PURCHASED_REASONS,
  WATCHED,
} from "./watched.ts";

// The shipped vendor is narrower than the shape DIM's manifest type describes
const vendorDef = (hash: number): SlimVendor | undefined =>
  defs()?.Vendor.getOptional(hash) as SlimVendor | undefined;

const DISPLAY_ONLY = VendorItemStatus.DisplayOnly;

/** Xur's own nextRefreshDate is his next arrival, not the end of the visit you are in */
export const visitEndsAt = (now: number): number =>
  xurPresent(now) ? nextWeeklyReset(now) : nextWeekendReset(now);

const nameOf = (
  items: VendorItems,
  hash: number,
): { name: string; icon: string | undefined } | undefined => {
  const shipped = items[hash];

  if (shipped?.name) {
    return { name: shipped.name, icon: shipped.icon };
  }

  const owned = defs()?.InventoryItem.getOptional(hash)?.displayProperties;

  return owned?.name ? { name: owned.name, icon: owned.icon } : undefined;
};

const costOf = (
  sale: DestinyVendorSaleItemComponent,
  items: VendorItems,
): Cost[] =>
  (sale.costs ?? []).flatMap((cost) => {
    if (!cost.itemHash || cost.quantity === 0) {
      return [];
    }

    return [
      {
        itemHash: cost.itemHash,
        name: nameOf(items, cost.itemHash)?.name ?? "",
        quantity: cost.quantity,
      },
    ];
  });

const VARIABLE = /\{var:(\d+)\}/g;

// The profile groups sale indexes by category, and only the definition names them
const categorySales = (
  response: DestinyVendorsResponse,
  vendor: number,
  def: SlimVendor,
  identifiers: string[],
): Set<number> => {
  const indexes = def.displayCategories
    .filter((named) => identifiers.includes(named.identifier))
    .map((named) => named.index);

  return new Set(
    (response.categories?.data?.[vendor]?.categories ?? [])
      .filter((one) => indexes.includes(one.displayCategoryIndex))
      .flatMap((one) => one.itemIndexes),
  );
};

const reasonsOf = (
  sale: DestinyVendorSaleItemComponent,
  def: SlimVendor,
): string[] =>
  (sale.failureIndexes ?? []).flatMap((at) => {
    const reason = def.failureStrings[at];

    return reason ? [reason] : [];
  });

const slotsOf = (
  def: SlimVendor,
  response: DestinyVendorsResponse,
  vendor: number,
  variables: Record<number, number>,
): Slot[] => {
  const live = response.categories?.data?.[vendor]?.categories ?? [];
  const sales = response.sales?.data?.[vendor]?.saleItems ?? {};

  return [...live]
    .sort((a, b) => a.displayCategoryIndex - b.displayCategoryIndex)
    .flatMap((group): Slot[] => {
      const named = def.displayCategories.find(
        (one) => one.index === group.displayCategoryIndex,
      );

      if (!named) {
        return [];
      }

      // The heading spells its own allowance out, as remaining over allowed
      const [remaining, allowed] = [...named.name.matchAll(VARIABLE)].map(
        (match) => variables[Number(match[1])] ?? 0,
      );

      return [
        {
          name: named.name,
          remaining: remaining ?? 0,
          allowed: allowed ?? 0,
          items: group.itemIndexes.flatMap((at) => {
            const sale = sales[at];

            return sale
              ? [
                  {
                    vendor,
                    itemHash: sale.itemHash,
                    vendorItemIndex: sale.vendorItemIndex,
                  },
                ]
              : [];
          }),
        },
      ];
    });
};

const rotationRows = (
  response: DestinyVendorsResponse,
  items: VendorItems,
  watch: Watch,
  ornaments: DestinyVendorSaleItemComponent[],
): RotationItem[][] =>
  (watch.rows ?? [])
    .map((row) =>
      row.flatMap((rotator) => {
        const def = vendorDef(rotator);

        if (!def) {
          return [];
        }

        const wanted =
          watch.categories === undefined
            ? undefined
            : categorySales(response, rotator, def, watch.categories);
        const sales = [
          ...(rotator === ARMOR_ORNAMENTS
            ? ornaments
            : Object.values(response.sales?.data?.[rotator]?.saleItems ?? {})),
        ].sort(
          (a, b) =>
            (def.itemSorts[a.vendorItemIndex] ?? 0) -
              (def.itemSorts[b.vendorItemIndex] ?? 0) ||
            a.vendorItemIndex - b.vendorItemIndex,
        );

        return sales.flatMap((sale): RotationItem[] => {
          const price = sale.costs?.find(
            (cost) => cost.itemHash === watch.currency,
          )?.quantity;

          if (
            price === undefined ||
            watch.skip?.includes(sale.itemHash) ||
            (wanted !== undefined && !wanted.has(sale.vendorItemIndex))
          ) {
            return [];
          }

          const reasons = reasonsOf(sale, def);

          return [
            {
              vendor: rotator,
              // Dummy stock never ships, so its tile comes from the real item
              itemHash: items[sale.itemHash]?.standIn ?? sale.itemHash,
              vendorItemIndex: sale.vendorItemIndex,
              cost: {
                icon: items[watch.currency ?? 0]?.icon,
                quantity: price,
              },
              reasons,
              purchased: reasons.some((reason) =>
                PURCHASED_REASONS.includes(reason),
              ),
            },
          ];
        });
      }),
    )
    .filter((row) => row.length > 0);

const heldOffer = (item: DimItem): Offer => {
  const steps = item.objectives ?? [];
  const progress = steps.reduce((sum, step) => sum + (step.progress ?? 0), 0);
  const goal = steps.reduce((sum, step) => sum + step.completionValue, 0);
  const expires = item.pursuit?.expiration?.expirationDate;

  return {
    index: item.hash,
    itemHash: item.hash,
    name: item.name,
    icon: item.icon,
    quantity: 1,
    costs: [],
    available: false,
    reasons: [],
    pursuit: {
      kind: "held",
      progress: `${progress.toLocaleString()}/${goal.toLocaleString()}`,
      expiresAt: expires === undefined ? undefined : expires.getTime(),
    },
  };
};

export const readVendors = (
  response: DestinyVendorsResponse | undefined,
  items: VendorItems,
  variables: Record<number, number>,
  held: readonly DimItem[],
  ornaments: DestinyVendorSaleItemComponent[],
): VendorState[] => {
  if (!response || !defs()) {
    return [];
  }

  return WATCHED.flatMap((watch): VendorState[] => {
    const { vendor, mode, categories, only, owned, pursuits } = watch;

    const live = response.vendors?.data?.[vendor];
    const def = vendorDef(vendor);

    if (!live || !def) {
      return [];
    }

    const shell = {
      hash: vendor,
      name: watch.name ?? def.displayProperties.name,
      mode,
      offers: [],
      slots: [],
      rows: [],
    };

    // The visit countdown is a clock reading, so the caller derives it and this stays stable
    if (mode === "visit") {
      return [
        {
          ...shell,
          refreshesAt: undefined,
          rows: rotationRows(response, items, watch, ornaments),
        },
      ];
    }

    const refreshesAt =
      live.nextRefreshDate === undefined
        ? undefined
        : new Date(live.nextRefreshDate).getTime();

    if (mode === "claims") {
      return [
        {
          ...shell,
          refreshesAt,
          slots: slotsOf(def, response, vendor, variables),
        },
      ];
    }

    if (mode === "rotation") {
      // The API says Tuesday, but the stock changes at the daily reset
      return [
        {
          ...shell,
          refreshesAt: undefined,
          rows: rotationRows(response, items, watch, ornaments),
        },
      ];
    }

    const wanted =
      categories === undefined
        ? undefined
        : categorySales(response, vendor, def, categories);

    const offers = Object.values(
      response.sales?.data?.[vendor]?.saleItems ?? {},
    ).flatMap((sale): Offer[] => {
      const skip =
        sale.saleStatus & DISPLAY_ONLY ||
        (only !== undefined && !only.includes(sale.itemHash)) ||
        (wanted !== undefined && !wanted.has(sale.vendorItemIndex));

      if (skip) {
        return [];
      }

      const item = nameOf(items, sale.itemHash);

      if (!item) {
        return [];
      }

      return [
        {
          index: sale.vendorItemIndex,
          itemHash: sale.itemHash,
          name: item.name,
          icon: item.icon,
          quantity: sale.quantity,
          costs: costOf(sale, items),
          available: sale.saleStatus === VendorItemStatus.Success,
          // The profile returns indices into the vendor's own refusal strings
          reasons: reasonsOf(sale, def),
          pursuit: undefined,
        },
      ];
    });

    // A costless row is a subscreen the vendor opens, or a rank-track reward
    const shown =
      categories === undefined
        ? offers.filter((offer) => offer.costs.length > 0)
        : offers;

    if (owned === undefined) {
      return [{ ...shell, refreshesAt, offers: shown }];
    }

    const holding = held.filter(
      (item) =>
        !!defs()
          ?.InventoryItem.getOptional(item.hash)
          ?.inventory?.stackUniqueLabel?.startsWith(owned),
    );
    const hashes = [
      ...new Set([
        ...(pursuits ?? []),
        ...shown.map((offer) => offer.itemHash),
        ...holding.map((item) => item.hash),
      ]),
    ];

    return [
      {
        ...shell,
        // Each one expires a week after pickup
        refreshesAt: undefined,
        offers: hashes.flatMap((hash): Offer[] => {
          // The vendor snapshot can lag the profile and still list held stock
          const holds = holding.find((item) => item.hash === hash);

          if (holds) {
            return [heldOffer(holds)];
          }

          const sold = shown.find((offer) => offer.itemHash === hash);

          if (sold) {
            return [sold];
          }

          const item = nameOf(items, hash);

          if (!item) {
            return [];
          }

          // Neither sold nor held, probably turned in this week
          return [
            {
              index: hash,
              itemHash: hash,
              name: item.name,
              icon: item.icon,
              quantity: 1,
              costs: [],
              available: false,
              reasons: [],
              pursuit: { kind: "completed" },
            },
          ];
        }),
      },
    ];
  });
};

/** Priority stock across every vendor in the response, not just the watched ones */
export const priorityOffers = (
  response: DestinyVendorsResponse | undefined,
  items: VendorItems,
): Priority[] => {
  const loaded = defs();

  if (!response || !loaded) {
    return [];
  }

  const found: Priority[] = [];

  for (const [vendor, block] of Object.entries(response.sales?.data ?? {})) {
    for (const sale of Object.values(block.saleItems ?? {})) {
      if (!PRIORITY.includes(sale.itemHash)) {
        continue;
      }

      const item = nameOf(items, sale.itemHash);
      const def = vendorDef(Number(vendor));

      if (!item || !def) {
        continue;
      }

      found.push({
        vendor: def.displayProperties.name,
        index: sale.vendorItemIndex,
        itemHash: sale.itemHash,
        name: item.name,
        icon: item.icon,
        quantity: sale.quantity,
        costs: costOf(sale, items),
        available: sale.saleStatus === VendorItemStatus.Success,
        reasons: reasonsOf(sale, def),
        pursuit: undefined,
      });
    }
  }

  return found;
};

const RANKS_BEFORE_CAP = 2;

/** Resettable vendor ranks at or near their cap, closest first */
export const rankResets = (
  response: DestinyVendorsResponse | undefined,
): RankReset[] => {
  const seen = new Set<number>();
  const found: RankReset[] = [];

  for (const [vendor, live] of Object.entries(response?.vendors?.data ?? {})) {
    const progression = live.progression;
    const def = vendorDef(Number(vendor));

    // Only resettable ranks carry currentResetCount
    if (
      !progression ||
      !def ||
      typeof progression.currentResetCount !== "number" ||
      seen.has(progression.progressionHash)
    ) {
      continue;
    }

    seen.add(progression.progressionHash);

    if (progression.level < progression.levelCap - RANKS_BEFORE_CAP) {
      continue;
    }

    found.push({
      vendor: Number(vendor),
      name: def.displayProperties.name,
      rank: progression.level,
      cap: progression.levelCap,
      resets: progression.currentResetCount,
    });
  }

  return found.sort((a, b) => a.cap - a.rank - (b.cap - b.rank));
};
