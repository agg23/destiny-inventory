import type { Plugin } from "esbuild";

// Matches on path suffix, so it catches the relative import form that tsconfig paths
// can't. Keep this in agreement with tsconfig.base.json, tsc reads one and the bundler
// reads the other

const SHIMS: { match: RegExp; shim: string }[] = [
  { match: /(^|\/)utils\/sentry$/, shim: "sentry.ts" },
  { match: /(^|\/)app\/i18n$/, shim: "i18n.ts" },
  { match: /(^|\/)app\/i18next-t$/, shim: "i18next-t.ts" },
  { match: /(^|\/)app\/store\/types$/, shim: "store-types.ts" },
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
