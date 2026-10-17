import {
  ComponentPrivacySetting,
  type DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { accessToken } from "../api/auth.ts";
import { fetchProfile, type Membership } from "../api/bungie.ts";
import { materializeNew } from "./load.ts";
import { NotSignedIn, type LoadResult, type Session } from "./loadTypes.ts";
import {
  characterRecords,
  mintedAt,
  orderRewards,
  playingNow,
  stringVariables,
} from "./profileReads.ts";
import { buildStoresFrom, storeItems } from "./stores.ts";

// The store factory bails on a profile with no inventory components
const withoutInventories = (
  profile: DestinyProfileResponse,
): DestinyProfileResponse => {
  const empty = {
    data: { items: [] },
    privacy: ComponentPrivacySetting.Private,
  };

  const byCharacter = {
    data: Object.fromEntries(
      Object.keys(profile.characters?.data ?? {}).map((id) => [
        id,
        { items: [] },
      ]),
    ),
    privacy: ComponentPrivacySetting.Private,
  };

  return {
    ...profile,
    profileInventory: profile.profileInventory?.data
      ? profile.profileInventory
      : empty,
    characterInventories: profile.characterInventories?.data
      ? profile.characterInventories
      : byCharacter,
    characterEquipment: profile.characterEquipment?.data
      ? profile.characterEquipment
      : byCharacter,
  };
};

const guestOf = (membership: Membership, profile: DestinyProfileResponse) => {
  const who = profile.profile?.data?.userInfo;

  return {
    membershipType: membership.membershipType,
    membershipId: membership.membershipId,
    name: who?.bungieGlobalDisplayName || who?.displayName || "Guardian",
    code: who?.bungieGlobalDisplayNameCode,
    pinned: false,
  };
};

/** Another account's profile built against the loaded definitions, and cached nowhere */
export const loadGuest = async (
  owner: LoadResult,
  membership: Membership,
): Promise<LoadResult> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const profile = withoutInventories(await fetchProfile(membership, token));

  const session: Session = {
    ...owner.session,
    membership,
    minted: mintedAt(profile),
    builtFrom: mintedAt(profile),
    contents: "",
    guest: guestOf(membership, profile),
  };

  await materializeNew(session, profile);

  const built = buildStoresFrom(
    session.support,
    session.items,
    session.plugSets,
    profile,
    session.hidden,
  );

  return {
    ...owner,
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    source: "live",
    playing: playingNow(profile),
    activities: profile.characterActivities?.data ?? {},
    variables: stringVariables(profile),
    records: characterRecords(profile),
    orderRewards: orderRewards(profile),
    counts: {
      ...owner.counts,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
    session,
  };
};
