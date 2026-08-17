import { build } from "esbuild";

import { DIM_GLOBALS } from "../../dim-bridge/build-globals.ts";
import { dimShimsPlugin } from "../../dim-bridge/dim-shims.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

const COUPLED = /node_modules\/(react|react-dom|react-redux|redux|redux-thunk|@reduxjs)\//;

const entries = process.argv.slice(2);

if (entries.length === 0) {
  throw new Error("Pass entry names, for example: node scripts/bundle.ts harness parity");
}

const result = await build({
  entryPoints: entries.map((name) => `${REPO_ROOT}packages/pipeline/src/${name}.ts`),
  outdir: `${REPO_ROOT}packages/pipeline/dist`,
  tsconfig: `${REPO_ROOT}tsconfig.base.json`,
  define: DIM_GLOBALS,
  plugins: [dimShimsPlugin(`${REPO_ROOT}packages/dim-bridge/src/shims`)],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "info",
  metafile: true,
});

const leaked = Object.values(result.metafile.outputs)
  .flatMap((output) => Object.keys(output.inputs))
  .filter((input) => COUPLED.test(input))
  .sort();

if (leaked.length > 0) {
  console.log(`\nreact/redux in the runtime bundle (${leaked.length}):`);
  for (const input of new Set(leaked)) {
    console.log(`  ${input}`);
  }
} else {
  console.log("\nNo react/redux in the runtime bundle");
}
