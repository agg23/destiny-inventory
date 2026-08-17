import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { brotliDecompressSync } from "node:zlib";

import type { Tables } from "@dvm/defs-core";

import { createHandler, type ArtifactLoader, type Artifacts } from "./core/index.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const ARTIFACT_ROOT = join(REPO_ROOT, "artifacts");
const PORT = Number(process.env.PORT ?? 8787);

const readArtifact = async (dir: string, files: string[], prefix: string) => {
  const name = files.find((file) => file.startsWith(`${prefix}.`));

  if (!name) {
    throw new Error(`No ${prefix} artifact, run: pnpm --filter @dvm/build build`);
  }

  return JSON.parse(brotliDecompressSync(await readFile(join(dir, name))).toString("utf8"));
};

const diskLoader = (): ArtifactLoader => {
  let cached: Artifacts | undefined = undefined;

  return {
    load: async () => {
      if (cached) {
        return cached;
      }

      const versions = await readdir(ARTIFACT_ROOT);
      const version = versions.at(-1);

      if (!version) {
        throw new Error("No artifacts, run: pnpm --filter @dvm/build build");
      }

      const dir = join(ARTIFACT_ROOT, version);
      const index = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as {
        manifestVersion: string;
        files: string[];
      };

      const tables: Tables = {
        items: await readArtifact(dir, index.files, "items"),
        plugSets: await readArtifact(dir, index.files, "plugsets"),
      };

      console.log(`Loaded ${Object.keys(tables.items).length} items, manifest ${index.manifestVersion}`);
      cached = { version: index.manifestVersion, tables };

      return cached;
    },
  };
};

const toRequest = (req: IncomingMessage, body: Buffer): Request =>
  new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).map(([key, value]) => [key, String(value)]),
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });

const send = async (res: ServerResponse, response: Response) => {
  res.writeHead(response.status, Object.fromEntries(response.headers));

  if (!response.body) {
    res.end();

    return;
  }

  Readable.fromWeb(response.body as never).pipe(res);
};

const handler = createHandler({
  apiKey: process.env.BUNGIE_API_KEY ?? "",
  clientId: process.env.BUNGIE_CLIENT_ID ?? "",
  clientSecret: process.env.BUNGIE_CLIENT_SECRET ?? "",
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? "*",
  loader: diskLoader(),
});

createServer((req, res) => {
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    handler(toRequest(req, Buffer.concat(chunks)))
      .then((response) => send(res, response))
      .catch((e: unknown) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      });
  });
}).listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
