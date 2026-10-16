import type { DimItem } from "app/inventory/item-types";
import type {
  DestinyVendorItemComponentSetOfint32,
  DestinyVendorSaleItemComponent,
  DestinyVendorsResponse,
} from "bungie-api-ts/destiny2";
import { VendorItemStatus } from "bungie-api-ts/destiny2";

import type { SlimReward, SlimVendor } from "@dvm/defs-core";

import { fetchRecords } from "./artifacts.ts";
import { accessToken } from "./auth.ts";
import { fetchVendor, fetchVendors, type Membership } from "./bungie.ts";
import { loadConfig } from "./config.ts";
import { defs } from "./defs.ts";
import type { CardCost } from "./preview.ts";
import { nextWeekendReset, nextWeeklyReset, xurPresent } from "./reset.ts";
// The shipped vendor is narrower than the shape DIM's manifest type describes
const vendorDef = (hash: number): SlimVendor | undefined =>
  defs()?.Vendor.getOptional(hash) as SlimVendor | undefined;

const DISPLAY_ONLY = VendorItemStatus.DisplayOnly;

export type Mode = "visit" | "offers" | "claims" | "rotation";

/** Xur's own nextRefreshDate is his next arrival, not the end of the visit you are in */
export const visitEndsAt = (now: number): number =>
  xurPresent(now) ? nextWeeklyReset(now) : nextWeekendReset(now);

interface Watch {
  vendor: number;
  mode: Mode;
  category?: string;
  only?: number[];
  rows?: number[][];
  // Stack label of stock the vendor stops offering once you hold it
  owned?: string;
}

const EXCHANGE = [2865242233, 825199458, 2001857187, 3612161799];

const BRIGHT_DUST = 2817410917;

// Each character only sees its own class's ornament here
const ARMOR_ORNAMENTS = 2031393824;

// Tess's weekly stock lives in these nameless sub-vendors, not on her
const BRIGHT_DUST_ROWS = [
  [2168194999, ARMOR_ORNAMENTS, 3118972542, 4020265966, 3702989297, 1105106638],
  [2184482416, 1446296883, 2041776156, 213864513],
];

export const WATCHED: Watch[] = [
  { vendor: 2190858386, mode: "visit" },
  { vendor: 3361454721, mode: "rotation", rows: BRIGHT_DUST_ROWS },
  { vendor: 153857624, mode: "claims" },
  { vendor: 3949128738, mode: "offers", only: EXCHANGE },
  {
    vendor: 3347378076,
    mode: "offers",
    category: "clan_bounties_vendor_display",
    owned: "social.clans.",
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
  vendor: number;
  itemHash: number;
  vendorItemIndex: number;
}

export interface Slot {
  name: string;
  remaining: number;
  allowed: number;
  items: SlotItem[];
}

export interface RotationItem extends SlotItem {
  cost: CardCost;
  purchased: boolean;
}

export interface VendorState {
  hash: number;
  name: string;
  mode: Mode;
  refreshesAt: number | undefined;
  offers: Offer[];
  slots: Slot[];
  rows: RotationItem[][];
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

export interface VendorFetch {
  character: string;
  response: DestinyVendorsResponse;
  items: VendorItems;
  components: VendorComponents;
  ornaments: DestinyVendorSaleItemComponent[];
}

let held: VendorFetch | undefined = undefined;

/** The last fetch for a character, kept across unmounts */
export const lastVendorFetch = (
  character: string | undefined,
): VendorFetch | undefined =>
  held && held.character === character ? held : undefined;

export const fetchVendorState = async (
  membership: Membership,
  character: string,
  characters: { id: string; classType: number }[],
): Promise<VendorFetch | undefined> => {
  const token = await accessToken();

  if (token === undefined) {
    return undefined;
  }

  const ordered = [...characters].sort((a, b) => a.classType - b.classType);

  const [response, items, classed, ...tiled] = await Promise.all([
    fetchVendors(membership, character, token),
    vendorItems(),
    Promise.all(
      ordered.map((one) =>
        one.id === character
          ? undefined
          : fetchVendor(membership, one.id, ARMOR_ORNAMENTS, token),
      ),
    ),
    ...TILED.map((vendor) => fetchVendor(membership, character, vendor, token)),
  ]);

  const ornaments = classed.flatMap((one) =>
    Object.values(
      one === undefined
        ? (response.sales?.data?.[ARMOR_ORNAMENTS]?.saleItems ?? {})
        : (one.sales?.data ?? {}),
    ),
  );

  const components: VendorComponents = {};

  TILED.forEach((vendor, at) => {
    const set = tiled[at]?.itemComponents;

    if (set) {
      components[vendor] = set;
    }
  });

  const fetched: VendorFetch = {
    character,
    response,
    items,
    components,
    ornaments,
  };

  held = fetched;

  return fetched;
};

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
  rows: number[][],
  ornaments: DestinyVendorSaleItemComponent[],
): RotationItem[][] =>
  rows
    .map((row) =>
      row.flatMap((rotator) => {
        const sales =
          rotator === ARMOR_ORNAMENTS
            ? ornaments
            : Object.values(response.sales?.data?.[rotator]?.saleItems ?? {});

        return sales.flatMap((sale): RotationItem[] => {
          const price = sale.costs?.find(
            (cost) => cost.itemHash === BRIGHT_DUST,
          )?.quantity;

          if (price === undefined) {
            return [];
          }

          return [
            {
              vendor: rotator,
              itemHash: sale.itemHash,
              vendorItemIndex: sale.vendorItemIndex,
              cost: { icon: items[BRIGHT_DUST]?.icon, quantity: price },
              // Their only refusal is "Already Purchased on Account"
              purchased: (sale.failureIndexes ?? []).length > 0,
            },
          ];
        });
      }),
    )
    .filter((row) => row.length > 0);

const ownedOffers = (held: readonly DimItem[], label: string): Offer[] =>
  held.flatMap((item) => {
    const stack = defs()?.InventoryItem.getOptional(item.hash)?.inventory
      ?.stackUniqueLabel;

    if (stack === undefined || !stack.startsWith(label)) {
      return [];
    }

    return [
      {
        index: item.hash,
        itemHash: item.hash,
        name: item.name,
        icon: item.icon,
        quantity: 1,
        costs: [],
        available: false,
        reasons: ["Already held"],
      },
    ];
  });

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
    const { vendor, mode, category, only, rows, owned } = watch;

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
      rows: [],
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

    if (mode === "rotation") {
      // The API says Tuesday, but the stock changes at the daily reset
      return [
        {
          ...shell,
          refreshesAt: undefined,
          rows: rotationRows(response, items, rows ?? [], ornaments),
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

    if (owned === undefined) {
      return [{ ...shell, refreshesAt, offers: shown }];
    }

    const holding = ownedOffers(held, owned);
    const holdingHashes = new Set(holding.map((offer) => offer.itemHash));

    return [
      {
        ...shell,
        refreshesAt,
        offers: [
          // The vendor snapshot can lag the profile and still list held stock
          ...shown.filter((offer) => !holdingHashes.has(offer.itemHash)),
          ...holding,
        ],
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
        reasons: (sale.failureIndexes ?? []).flatMap((at) => {
          const reason = def.failureStrings[at];

          return reason ? [reason] : [];
        }),
      });
    }
  }

  return found;
};

const RANKS_BEFORE_CAP = 2;

export interface RankReset {
  vendor: number;
  name: string;
  rank: number;
  cap: number;
  resets: number;
}

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
