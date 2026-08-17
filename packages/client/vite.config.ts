import { fileURLToPath } from "node:url";

import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

import { DIM_GLOBALS } from "../dim-bridge/build-globals.ts";
import { SHIMS } from "../dim-bridge/dim-shims.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [solid()],
  define: DIM_GLOBALS,
  resolve: {
    alias: [
      ...SHIMS.map(({ match, shim }) => ({
        find: match,
        replacement: root(`../dim-bridge/src/shims/${shim}`),
      })),
      { find: /^app\//, replacement: root("../../vendor/DIM/src/app/") },
      { find: /^data\//, replacement: root("../../vendor/DIM/src/data/") },
    ],
  },
  server: {
    port: 5183,
    proxy: {
      "/api": { target: "http://localhost:8791", rewrite: (path) => path.replace(/^\/api/, "") },
    },
  },
});
