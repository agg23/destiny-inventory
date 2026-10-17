import type { DimStore } from "app/inventory/store-types";
import { createSignal, untrack } from "solid-js";

import { accessToken } from "./api/auth.ts";
import { fetchVendors } from "./api/bungie.ts";
import { vendorNotices, type Notice } from "./notices.ts";
import { defs } from "./profile/defs.ts";
import type { LoadResult } from "./profile/loadTypes.ts";
import { readStored, writeStored } from "./storage.ts";
import { MINUTE } from "./time.ts";
import { vendorItems } from "./todo/vendorFetch.ts";

const KEY = "dvm.statusVendorNotices";

const POLL = 3 * MINUTE;

interface Polled {
  at: number;
  notices: Notice[];
}

const [polled, setPolled] = createSignal<Record<string, Polled>>(
  (readStored(KEY) as Record<string, Polled> | undefined) ?? {},
);

const [fetching, setFetching] = createSignal(false);

let inFlight: string | undefined = undefined;

/** The last polled vendor notices for a character, kept across reloads */
export const cachedVendorNotices = (character: string): Notice[] =>
  polled()[character]?.notices ?? [];

export const vendorsFetching = fetching;

/** Polls GetVendors for a character unless a recent poll is cached */
export const pollVendors = async (
  loaded: LoadResult,
  store: DimStore,
  now: number,
) => {
  const character = store.id;
  const last = untrack(polled)[character];

  // Vendors need the account's own token, and the defs to name anything
  if (
    !defs() ||
    loaded.session.guest ||
    inFlight === character ||
    (last && now - last.at < POLL)
  ) {
    return;
  }

  const token = await accessToken();

  if (token === undefined) {
    return;
  }

  inFlight = character;
  setFetching(true);

  try {
    const [response, items] = await Promise.all([
      fetchVendors(loaded.session.membership, character, token),
      vendorItems(),
    ]);
    const next = {
      ...untrack(polled),
      [character]: {
        at: Date.now(),
        notices: vendorNotices(
          response,
          items,
          store,
          loaded.variables[character] ?? {},
          Date.now(),
        ),
      },
    };

    setPolled(next);
    writeStored(KEY, next);
  } catch (e: unknown) {
    console.warn("Vendor poll failed", e);
  } finally {
    inFlight = undefined;
    setFetching(false);
  }
};
