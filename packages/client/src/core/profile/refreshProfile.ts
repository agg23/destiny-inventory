import { requireToken } from "../api/auth.ts";
import { fetchProfile } from "../api/bungie.ts";
import { loadConfig } from "../api/config.ts";
import { rebuildProfile, stamp } from "./load.ts";
import type { LoadResult, RefreshOutcome } from "./loadTypes.ts";
import { ageOf, liveFields, mintedAt } from "./profileReads.ts";
import { saveSnapshot } from "./snapshot.ts";

export const refreshProfile = async (
  first: LoadResult,
): Promise<RefreshOutcome> => {
  const token = await requireToken();
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
  const fields = liveFields(profile);
  const playing = fields.playing;
  const rebuilt = await rebuildProfile(first, profile, fields);

  if (rebuilt.kind === "stale") {
    console.info(`Profile ${ageOf(minted)} old, discarded`);

    return { status: "unchanged", playing, result: undefined };
  }

  if (rebuilt.kind === "same") {
    console.info(`Profile ${ageOf(minted)} old, no item changes`);

    return { status: "updated", playing, result: { ...first, ...fields } };
  }

  console.info(`Profile ${ageOf(minted)} old, rebuilt`);
  saveSnapshot(session.store, rebuilt.result, stamp(first.manifestVersion));

  return { status: "updated", playing, result: rebuilt.result };
};
