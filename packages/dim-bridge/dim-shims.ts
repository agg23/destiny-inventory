import type { Plugin } from "esbuild";

// Whole-specifier match, so Vite's alias replaces the id
// Keep in sync with tsconfig.base.json
export const SHIMS: { match: RegExp; shim: string }[] = [
  { match: /^(?:.*\/)?utils\/sentry$/, shim: "sentry.ts" },
  { match: /^(?:.*\/)?utils\/log$/, shim: "log.ts" },
  { match: /^(?:.*\/)?dim-ui\/BungieImage$/, shim: "bungie-image.ts" },
  { match: /^(?:.*\/)?app\/i18n$/, shim: "i18n.ts" },
  { match: /^(?:.*\/)?app\/i18next-t$/, shim: "i18next-t.ts" },
  { match: /^(?:.*\/)?app\/store\/types$/, shim: "store-types.ts" },
  { match: /^(?:.*\/)?records\/collectible-matching$/, shim: "collectible-matching.ts" },
  { match: /^@sentry\/(browser|react)$/, shim: "sentry-sdk.ts" },
];

export const dimShimsPlugin = (shimDir: string): Plugin => ({
  name: "dim-shims",
  setup(build) {
    for (const { match, shim } of SHIMS) {
      build.onResolve({ filter: match }, () => ({ path: `${shimDir}/${shim}` }));
    }
  },
});
