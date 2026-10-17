import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import { defineConfig, type Plugin } from "vite";

import { DIM_GLOBALS } from "../dim-bridge/build-globals.ts";
import { dimAliases, dimPathShimsPlugin } from "../dim-bridge/dim-shims.ts";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Point at the deployed Worker to develop against it without local credentials
const API_TARGET = process.env.DVM_API_TARGET ?? "http://localhost:8791";
const REMOTE = !API_TARGET.includes("localhost");

// Unchanged rebuilds keep the same version
const buildVersion = (): Plugin => {
  let outDir = "";
  let version = "";

  return {
    name: "dvm-build-version",
    apply: "build",
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: "post",
      handler: (html) => {
        version = createHash("sha256").update(html).digest("hex").slice(0, 16);

        return [
          {
            tag: "meta",
            attrs: { name: "build-version", content: version },
            injectTo: "head",
          },
        ];
      },
    },
    closeBundle: () => {
      writeFileSync(join(outDir, "version.json"), JSON.stringify({ version }));
    },
  };
};

export default defineConfig(() => {
  return {
    plugins: [
      dimPathShimsPlugin(root("../dim-bridge/src/shims")),
      tailwind(),
      solid(),
      buildVersion(),
    ],
    define: DIM_GLOBALS,
    resolve: {
      alias: [
        ...dimAliases(root("../../")),
        {
          find: /^destiny-icons\//,
          replacement: root("../../vendor/DIM/destiny-icons/"),
        },
      ],
    },
    server: {
      port: 5183,
      strictPort: true,
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
