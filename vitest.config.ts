import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { DIM_GLOBALS } from "./packages/dim-bridge/build-globals.ts";
import { dimAliases, dimPathShimsPlugin } from "./packages/dim-bridge/dim-shims.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// DIM's move tests run against the vendored tree with the client's aliases
export default defineConfig({
  plugins: [dimPathShimsPlugin(root("./packages/dim-bridge/src/shims"))],
  define: DIM_GLOBALS,
  resolve: {
    alias: [
      ...dimAliases(root("./")),
      // The service's entry sits under core/
      { find: /^@dvm\/service$/, replacement: root("./packages/service/src/core/index.ts") },
      { find: /^@dvm\/([^/]+)$/, replacement: root("./packages/$1/src/index.ts") },
      // Replaces DIM's harness. Upstream test files run unmodified
      { find: /^testing\//, replacement: root("./packages/move-tests/src/") },
    ],
  },
  test: {
    globals: true,
    setupFiles: [root("./packages/move-tests/src/setup.ts")],
    include: [
      "vendor/DIM/src/app/inventory/item-move-{service,matrix}.test.ts",
      "packages/*/src/**/*.test.ts",
    ],
    testTimeout: 60_000,
  },
});
