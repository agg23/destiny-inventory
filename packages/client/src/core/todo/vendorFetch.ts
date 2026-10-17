import type { SlimVendorItem } from "@dvm/defs-core";

import { fetchRecords } from "../api/artifacts.ts";
import { accessToken } from "../api/auth.ts";
import { fetchVendor, fetchVendors, type Membership } from "../api/bungie.ts";
import { loadConfig } from "../api/config.ts";
import type {
  VendorComponents,
  VendorFetch,
  VendorItems,
} from "./vendorTypes.ts";
import { ARMOR_ORNAMENTS, WATCHED } from "./watched.ts";

let pending: Promise<VendorItems> | undefined = undefined;

/**
 * Vendor stock is dummy items, shipped separately from the vault's own definitions.
 * Reads the served index, since a boot from snapshot carries an older one.
 */
export const vendorItems = (): Promise<VendorItems> => {
  pending ??= (async () => {
    const { artifacts } = await loadConfig();
    const rows = await fetchRecords<SlimVendorItem>(artifacts, "VendorItem");
    const byHash: VendorItems = {};

    for (const row of rows) {
      byHash[row.hash] = row;
    }

    return byHash;
  })();

  return pending;
};

/** Vendors whose stock we draw as item tiles, so their rolls have to be fetched */
export const TILED: number[] = WATCHED.flatMap((watch) => {
  if (watch.mode === "claims") {
    return [watch.vendor];
  }

  return watch.mode === "visit" ? (watch.rows ?? []).flat() : [];
});

export let held: VendorFetch | undefined = undefined;

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
