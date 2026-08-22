import type { Plugin } from "esbuild";
import type { Plugin as VitePlugin } from "vite";

// Whole-specifier match, so Vite's alias replaces the id
// Keep in sync with tsconfig.base.json
export const SHIMS: { match: RegExp; shim: string }[] = [
  { match: /^(?:.*\/)?utils\/sentry$/, shim: "sentry.ts" },
  { match: /^(?:.*\/)?utils\/log$/, shim: "log.ts" },
  { match: /^(?:.*\/)?dim-ui\/BungieImage$/, shim: "bungie-image.ts" },
  { match: /^(?:.*\/)?app\/i18n$/, shim: "i18n.ts" },
  { match: /^(?:.*\/)?app\/i18next-t$/, shim: "i18next-t.ts" },
  { match: /^(?:.*\/)?app\/store\/types$/, shim: "store-types.ts" },
  { match: /^(?:.*\/)?app\/store\/store$/, shim: "store.ts" },
  { match: /^(?:.*\/)?records\/collectible-matching$/, shim: "collectible-matching.ts" },
  { match: /^(?:.*\/)?bungie-api\/destiny1-api$/, shim: "destiny1-api.ts" },
  { match: /^(?:.*\/)?bungie-api\/destiny2-api$/, shim: "destiny2-api.ts" },
  { match: /^@sentry\/(browser|react)$/, shim: "sentry-sdk.ts" },
];

// Modules DIM imports relatively, where the specifier alone cannot identify the target:
// `./selectors` means something different in every feature directory
export const PATH_SHIMS: { vendorPath: string; shim: string }[] = [
  { vendorPath: "app/inventory/selectors.ts", shim: "inventory-selectors.ts" },
  { vendorPath: "app/loadout/selectors.ts", shim: "loadout-selectors.ts" },
  { vendorPath: "app/inventory/cross-tab.ts", shim: "cross-tab.ts" },
  { vendorPath: "app/accounts/destiny-account.ts", shim: "destiny-account.ts" },
  { vendorPath: "app/inventory/dim-item-info.ts", shim: "dim-item-info.ts" },
  { vendorPath: "app/accounts/actions.ts", shim: "accounts-actions.ts" },
  { vendorPath: "app/accounts/reducer.ts", shim: "accounts-reducer.ts" },
  { vendorPath: "app/search/filter-description.tsx", shim: "filter-description.ts" },
];

export const dimPathShimsPlugin = (shimDir: string): VitePlugin => ({
  name: "dim-path-shims",
  enforce: "pre",
  async resolveId(source, importer, options) {
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    const match =
      resolved &&
      PATH_SHIMS.find(({ vendorPath }) => resolved.id.endsWith(`/vendor/DIM/src/${vendorPath}`));

    return match ? `${shimDir}/${match.shim}` : undefined;
  },
});

export const dimShimsPlugin = (shimDir: string): Plugin => ({
  name: "dim-shims",
  setup(build) {
    for (const { match, shim } of SHIMS) {
      build.onResolve({ filter: match }, () => ({ path: `${shimDir}/${shim}` }));
    }
  },
});
