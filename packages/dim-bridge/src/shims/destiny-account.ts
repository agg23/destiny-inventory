import type { BungieMembershipType } from "bungie-api-ts/user";

// Real module pulls in the icon set. Move layer only needs the type
export interface DestinyAccount {
  readonly displayName: string;
  readonly originalPlatformType: BungieMembershipType;
  readonly platformLabel: string;
  readonly membershipId: string;
  readonly destinyVersion: 1 | 2;
  readonly platforms: BungieMembershipType[];
  readonly lastPlayed: Date;
}

export const compareAccounts = (a: DestinyAccount, b: DestinyAccount): boolean =>
  a.membershipId === b.membershipId && a.destinyVersion === b.destinyVersion;
