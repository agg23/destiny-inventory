import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const ARTIFACT_ROOT = join(REPO_ROOT, "artifacts");
const DIST = join(REPO_ROOT, "packages", "client", "dist", "artifacts");

const main = async () => {
  const version = (await readdir(ARTIFACT_ROOT)).sort().at(-1);

  if (!version) {
    throw new Error("No artifacts, run: pnpm build:artifacts");
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(join(ARTIFACT_ROOT, version), DIST, { recursive: true });

  console.log(`Staged ${version} into ${DIST}`);
};

await main();
