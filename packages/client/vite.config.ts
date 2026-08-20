import { fileURLToPath } from "node:url";

import tailwind from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

import { DIM_GLOBALS } from "../dim-bridge/build-globals.ts";
import { dimPathShimsPlugin, SHIMS } from "../dim-bridge/dim-shims.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Point at the deployed Worker to develop against it without local credentials
const API_TARGET = process.env.DVM_API_TARGET ?? "http://localhost:8791";
const REMOTE = !API_TARGET.includes("localhost");

export default defineConfig(() => {
  return {
    plugins: [dimPathShimsPlugin(root("../dim-bridge/src/shims")), tailwind(), solid()],
    define: DIM_GLOBALS,
    css: {
      preprocessorOptions: {
        // destiny-ui-css still uses @import; silenced the same way its own build does
        scss: {
          silenceDeprecations: ["import", "color-functions", "global-builtin"],
        },
      },
    },
    resolve: {
      alias: [
        ...SHIMS.map(({ match, shim }) => ({
          find: match,
          replacement: root(`../dim-bridge/src/shims/${shim}`),
        })),
        { find: /^app\//, replacement: root("../../vendor/DIM/src/app/") },
        { find: /^data\//, replacement: root("../../vendor/DIM/src/data/") },
        { find: /^images\//, replacement: root("../../vendor/DIM/src/images/") },
      ],
    },
    server: {
      port: 5183,
      proxy: {
        "/api": {
          target: API_TARGET,
          changeOrigin: REMOTE,
          // The deployed Worker already mounts the handler under /api
          rewrite: (path) => (REMOTE ? path : path.replace(/^\/api/, "")),
        },
        // Served by the platform's asset handler once deployed
        "/artifacts": { target: API_TARGET, changeOrigin: REMOTE },
      },
    },
  };
});
