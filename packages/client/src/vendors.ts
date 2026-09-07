import type {
  DestinyVendorItemComponentSetOfint32,
  DestinyVendorSaleItemComponent,
  DestinyVendorsResponse,
} from "bungie-api-ts/destiny2";
import { VendorItemStatus } from "bungie-api-ts/destiny2";

import type { SlimReward, SlimVendor } from "@dvm/defs-core";

import { fetchRecords } from "./artifacts.ts";
import { loadConfig } from "./config.ts";
import { defs } from "./defs.ts";
import { nextWeekendReset, nextWeeklyReset, xurPresent } from "./reset.ts";
// The shipped vendor is narrower than the shape DIM's manifest type describes
const vendorDef = (hash: number): SlimVendor | undefined =>
  defs()?.Vendor.getOptional(hash) as SlimVendor | undefined;

const DISPLAY_ONLY = VendorItemStatus.DisplayOnly;

export type Mode = "visit" | "offers" | "claims";

/** Xur's own nextRefreshDate is his next arrival, not the end of the visit you are in */
export const visitEndsAt = (now: number): number =>
  xurPresent(now) ? nextWeeklyReset(now) : nextWeekendReset(now);

interface Watch {
  vendor: number;
  mode: Mode;
  category?: string;
  only?: number[];
}

const EXCHANGE = [2865242233, 825199458, 2001857187, 3612161799];

export const WATCHED: Watch[] = [
  { vendor: 2190858386, mode: "visit" },
  { vendor: 153857624, mode: "claims" },
  { vendor: 3949128738, mode: "offers", only: EXCHANGE },
  {
    vendor: 3347378076,
    mode: "offers",
    category: "clan_bounties_vendor_display",
  },
];

// Worth surfacing wherever it turns up, however rarely a vendor stocks it
const PRIORITY = [2001857187, 2228452164];

export type VendorItems = Record<number, SlimReward>;

let pending: Promise<VendorItems> | undefined = undefined;

/**
 * Vendor stock is dummy items, shipped separately from the vault's own definitions.
 * Reads the served index, since a boot from snapshot carries an older one.
 */
export const vendorItems = (): Promise<VendorItems> => {
  pending ??= (async () => {
    const { artifacts } = await loadConfig();
    const rows = await fetchRecords<SlimReward>(artifacts, "VendorItem");
    const byHash: VendorItems = {};

    for (const row of rows) {
      byHash[row.hash] = row;
    }

    return byHash;
  })();

  return pending;
};

export interface Cost {
  itemHash: number;
  name: string;
  quantity: number;
}

export interface Offer {
  index: number;
  itemHash: number;
  name: string;
  icon: string | undefined;
  quantity: number;
  costs: Cost[];
  available: boolean;
  reasons: string[];
}

export interface SlotItem {
  itemHash: number;
  vendorItemIndex: number;
}

export interface Slot {
  name: string;
  remaining: number;
  allowed: number;
  items: SlotItem[];
}

export interface VendorState {
  hash: number;
  name: string;
  mode: Mode;
  refreshesAt: number | undefined;
  offers: Offer[];
  slots: Slot[];
}

export interface Priority extends Offer {
  vendor: string;
}

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

export type VendorComponents = Record<
  number,
  DestinyVendorItemComponentSetOfint32
>;

/** Vendors whose stock we draw as item tiles, so their rolls have to be fetched */
export const TILED: number[] = WATCHED.filter(
  (watch) => watch.mode === "claims",
).map((watch) => watch.vendor);

/** Plugs the vendors' rolls name, for the on-demand def pull */
export const vendorPlugHashes = (components: VendorComponents): number[] => {
  const hashes: number[] = [];

  for (const set of Object.values(components)) {
    for (const sale of Object.values(set.sockets?.data ?? {})) {
      for (const socket of sale.sockets) {
        if (socket.plugHash !== undefined) {
          hashes.push(socket.plugHash);
        }
      }
    }

    for (const sale of Object.values(set.reusablePlugs?.data ?? {})) {
      for (const plugs of Object.values(sale.plugs)) {
        for (const plug of plugs) {
          hashes.push(plug.plugItemHash);
        }
      }
    }
  }

  return hashes;
};

const VARIABLE = /\{var:(\d+)\}/g;

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

export const readVendors = (
  response: DestinyVendorsResponse | undefined,
  items: VendorItems,
  variables: Record<number, number>,
): VendorState[] => {
  if (!response || !defs()) {
    return [];
  }

  return WATCHED.flatMap(({ vendor, mode, category, only }): VendorState[] => {
    const live = response.vendors?.data?.[vendor];
    const def = vendorDef(vendor);

    if (!live || !def) {
      return [];
    }

    const shell = {
      hash: vendor,
      name: def.displayProperties.name,
      mode,
      offers: [],
      slots: [],
    };

    // The visit countdown is a clock reading, so the caller derives it and this stays stable
    if (mode === "visit") {
      return [{ ...shell, refreshesAt: undefined }];
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

    // The profile groups sale indexes by category, and only the definition names them
    const wanted =
      category === undefined
        ? undefined
        : new Set(
            (response.categories?.data?.[vendor]?.categories ?? []).find(
              (one) =>
                one.displayCategoryIndex ===
                def.displayCategories.find(
                  (named) => named.identifier === category,
                )?.index,
            )?.itemIndexes ?? [],
          );

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
          reasons: (sale.failureIndexes ?? []).flatMap((at) => {
            const reason = def.failureStrings[at];

            return reason ? [reason] : [];
          }),
        },
      ];
    });

    // A costless row is a subscreen the vendor opens, or a rank-track reward
    const shown =
      category === undefined
        ? offers.filter((offer) => offer.costs.length > 0)
        : offers;

    return [{ ...shell, refreshesAt, offers: shown }];
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
        reasons: (sale.failureIndexes ?? []).flatMap((at) => {
          const reason = def.failureStrings[at];

          return reason ? [reason] : [];
        }),
      });
    }
  }

  return found;
};
