import { join } from "node:path";

export const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
export const DATA_ROOT = join(REPO_ROOT, ".cache");
export const CACHE_ROOT = join(DATA_ROOT, "manifest");
export const ARTIFACT_ROOT = join(REPO_ROOT, "artifacts");
