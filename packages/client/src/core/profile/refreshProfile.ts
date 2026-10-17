import { accessToken } from "../api/auth.ts";
import { fetchProfile } from "../api/bungie.ts";
import { loadConfig } from "../api/config.ts";
import { CURRENT, materializeNew, stamp } from "./load.ts";
import {
  NotSignedIn,
  type LoadResult,
  type RefreshOutcome,
} from "./loadTypes.ts";
import { seedInventory } from "./moves.ts";
import {
  ageOf,
  characterRecords,
  contentsOf,
  isStale,
  mintedAt,
  orderRewards,
  playingNow,
  sameContents,
  stringVariables,
} from "./profileReads.ts";
import { saveSnapshot } from "./snapshot.ts";
import { PROFILE } from "./store.ts";
import { buildStoresFrom, storeItems } from "./stores.ts";

export const refreshProfile = async (
  first: LoadResult,
): Promise<RefreshOutcome> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const session = first.session;
  const config = await loadConfig();

  if (config.artifacts.manifestVersion !== session.index.manifestVersion) {
    return {
      status: "manifest-changed",
      playing: undefined,
      result: undefined,
    };
  }

  const profile = await fetchProfile(session.membership, token);
  const minted = mintedAt(profile);
  const playing = playingNow(profile);

  if (isStale(session, minted)) {
    console.info(`Profile ${ageOf(minted)} old, discarded`);

    return { status: "unchanged", playing, result: undefined };
  }

  const contents = contentsOf(profile);

  if (sameContents(session, contents)) {
    session.minted = minted;
    console.info(`Profile ${ageOf(minted)} old, no item changes`);

    return {
      status: "updated",
      playing,
      result: {
        ...first,
        source: "live",
        playing,
        activities: profile.characterActivities?.data ?? {},
        variables: stringVariables(profile),
        records: characterRecords(profile),
        orderRewards: orderRewards(profile),
      },
    };
  }

  await materializeNew(session, profile);

  if (isStale(session, minted)) {
    console.info(`Profile ${ageOf(minted)} old, discarded`);

    return { status: "unchanged", playing, result: undefined };
  }

  void session.store.putOne(PROFILE, CURRENT, profile);

  const built = buildStoresFrom(
    session.support,
    session.items,
    session.plugSets,
    profile,
    session.hidden,
  );

  session.minted = minted;
  session.builtFrom = minted;
  session.contents = contents;
  await seedInventory(built.stores, session.membership);
  console.info(`Profile ${ageOf(minted)} old, rebuilt`);

  const result: LoadResult = {
    ...first,
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    source: "live",
    playing,
    activities: profile.characterActivities?.data ?? {},
    variables: stringVariables(profile),
    records: characterRecords(profile),
    orderRewards: orderRewards(profile),
    counts: {
      ...first.counts,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
  };

  saveSnapshot(session.store, result, stamp(first.manifestVersion));

  return { status: "updated", playing, result };
};
