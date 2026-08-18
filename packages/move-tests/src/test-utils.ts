import { readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import { once } from "es-toolkit";

import { buildDefinitions } from "@dvm/dim-bridge";

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

const CACHE = repo(".cache/manifest");
const PROFILE = repo("vendor/DIM/src/testing/data/profile-2026-06-09.json");

// DIM's harness downloads the manifest from Bungie on demand. The build step already keeps a
// full copy, so the tests read that instead of putting a network call in the way
const newestManifest = async (): Promise<string> => {
  const versions = await readdir(CACHE);

  if (versions.length === 0) {
    throw new Error(`No manifest in ${CACHE}. Run pnpm build:artifacts first`);
  }

  const stamped = await Promise.all(
    versions.map(async (version) => ({
      version,
      at: (await stat(join(CACHE, version))).mtimeMs,
    })),
  );

  return join(CACHE, stamped.sort((a, b) => b.at - a.at)[0]!.version);
};

export const getTestDefinitions = once(async (): Promise<D2ManifestDefinitions> => {
  const dir = await newestManifest();
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
  const tables = new Map<string, Record<string, unknown>>();

  for (const file of files) {
    const raw = JSON.parse(await readFile(join(dir, file), "utf8")) as Record<string, unknown>;
    tables.set(file.replace(/\.json$/, ""), raw);
  }

  return buildDefinitions(tables);
});

// Synchronous because the test helpers call it inline while building stores
export const getTestProfile = once(
  (): DestinyProfileResponse =>
    (JSON.parse(readFileSync(PROFILE, "utf8")) as { Response: DestinyProfileResponse }).Response,
);

export const testAccount = {
  displayName: "VidBoi-BMC",
  originalPlatformType: 2,
  membershipId: "4611686018433092312",
  platformLabel: "PlayStation",
  destinyVersion: 2,
  platforms: [1, 3, 5, 2],
  lastPlayed: "2021-05-08T03:34:26.000Z",
};

// The tests only reach i18n through DimError messages, which assert on codes rather than text
export const setupi18n = async (): Promise<void> => {};
