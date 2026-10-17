import { keyBy } from "es-toolkit";

import type { SlimVendorItem } from "@dvm/defs-core";

import { fetchRecords } from "../api/artifacts.ts";
import { accessToken } from "../api/auth.ts";
import { fetchVendor, fetchVendors, type Membership } from "../api/bungie.ts";
import { cached } from "../api/cache.ts";
import { loadConfig } from "../api/config.ts";
import type {
  VendorComponents,
  VendorFetch,
  VendorItems,
} from "./vendorTypes.ts";
import { ARMOR_ORNAMENTS, WATCHED } from "./watched.ts";

// Reads the served index, a snapshot boot carries an older one
export const vendorItems = cached(async (): Promise<VendorItems> => {
  const { artifacts } = await loadConfig();
  const rows = await fetchRecords<SlimVendorItem>(artifacts, "VendorItem");

  return keyBy(rows, (row) => row.hash);
});

const TILED: number[] = WATCHED.flatMap((watch) => {
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
