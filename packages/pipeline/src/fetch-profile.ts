import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { DATA_ROOT } from "@dvm/build";
import {
  currentMemberships,
  fetchProfile,
  resolveBungieName,
  type Membership,
} from "@dvm/service";

import { PROFILE_FIXTURE, TOKENS } from "./fixture.ts";

const loadAccessToken = async (): Promise<string | undefined> => {
  if (process.env.BUNGIE_ACCESS_TOKEN) {
    return process.env.BUNGIE_ACCESS_TOKEN;
  }

  if (!existsSync(TOKENS)) {
    return undefined;
  }

  const tokens = JSON.parse(await readFile(TOKENS, "utf8")) as { access_token: string };

  return tokens.access_token;
};

const resolveMembership = async (
  apiKey: string,
  accessToken: string | undefined,
): Promise<Membership> => {
  const membershipId = process.env.BUNGIE_MEMBERSHIP_ID;
  const membershipType = process.env.BUNGIE_MEMBERSHIP_TYPE;

  if (membershipId && membershipType) {
    return { membershipId, membershipType: Number(membershipType) };
  }

  if (accessToken) {
    const memberships = await currentMemberships(apiKey, accessToken);
    const [first] = memberships;

    if (!first) {
      throw new Error("Token is valid but the account has no Destiny memberships");
    }

    return first;
  }

  const bungieName = process.env.BUNGIE_NAME;

  if (!bungieName) {
    throw new Error("Run auth.ts for a token, or set BUNGIE_NAME to a name like Guardian#1234");
  }

  return resolveBungieName(bungieName, apiKey);
};

const main = async () => {
  const apiKey = process.env.BUNGIE_API_KEY;

  if (!apiKey) {
    throw new Error("Set BUNGIE_API_KEY in .env");
  }

  const accessToken = await loadAccessToken();
  const membership = await resolveMembership(apiKey, accessToken);

  console.log(`Profile ${membership.membershipType}/${membership.membershipId}`);
  console.log(accessToken ? "Authenticated, vault included" : "Anonymous, public data only");

  const profile = await fetchProfile(membership, apiKey, accessToken);

  await mkdir(DATA_ROOT, { recursive: true });
  await writeFile(PROFILE_FIXTURE, JSON.stringify(profile), "utf8");

  const vault = profile.profileInventory?.data?.items.length ?? 0;
  const characters = Object.keys(profile.characters?.data ?? {}).length;
  const equipped = Object.values(profile.characterEquipment?.data ?? {}).reduce(
    (total, equipment) => total + equipment.items.length,
    0,
  );

  console.log(`\nWrote ${PROFILE_FIXTURE}`);
  console.log(`  vault items: ${vault}`);
  console.log(`  characters:  ${characters}`);
  console.log(`  equipped:    ${equipped}`);
};

await main();
