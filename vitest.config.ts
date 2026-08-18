import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { DIM_GLOBALS } from "./packages/dim-bridge/build-globals.ts";
import { dimPathShimsPlugin, SHIMS } from "./packages/dim-bridge/dim-shims.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The move tests are DIM's own, so they run against the vendored tree through the same
// aliases the client uses. Jest globals are off; the ports use vitest's
export default defineConfig({
  plugins: [dimPathShimsPlugin(root("./packages/dim-bridge/src/shims"))],
  define: DIM_GLOBALS,
  resolve: {
    alias: [
      ...SHIMS.map(({ match, shim }) => ({
        find: match,
        replacement: root(`./packages/dim-bridge/src/shims/${shim}`),
      })),
      { find: /^@dvm\/([^/]+)$/, replacement: root("./packages/$1/src/index.ts") },
      { find: /^app\//, replacement: root("./vendor/DIM/src/app/") },
      { find: /^data\//, replacement: root("./vendor/DIM/src/data/") },
      { find: /^images\//, replacement: root("./vendor/DIM/src/images/") },
      // DIM's own harness downloads a manifest and drives its full Redux store; ours stands
      // in at the same specifier so the test files themselves stay untouched upstream
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
