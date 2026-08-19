import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import {
  createHandler,
  type ArtifactIndex,
  type ArtifactLoader,
} from "./core/index.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const ARTIFACT_ROOT = join(REPO_ROOT, "artifacts");
const PORT = Number(process.env.PORT ?? 8787);

const artifactDir = async (): Promise<string> => {
  const versions = await readdir(ARTIFACT_ROOT);
  const version = versions.sort().at(-1);

  if (!version) {
    throw new Error("No artifacts, run: pnpm --filter @dvm/build build");
  }

  return join(ARTIFACT_ROOT, version);
};

const read = async (file: string): Promise<ArrayBuffer | undefined> => {
  try {
    return detach(await readFile(join(await artifactDir(), file)));
  } catch {
    return undefined;
  }
};

const diskLoader = (): ArtifactLoader => ({
  index: async () => {
    const body = await read("index.json");

    return body
      ? (JSON.parse(new TextDecoder().decode(body)) as ArtifactIndex)
      : undefined;
  },
  raw: (file) => read(file),
});

const detach = (body: Buffer): ArrayBuffer =>
  body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;

const toRequest = (req: IncomingMessage, body: Buffer): Request =>
  new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).map(
      ([key, value]) => [key, String(value)] as [string, string],
    ),
    body:
      req.method === "GET" || req.method === "HEAD" ? undefined : detach(body),
  });

const send = (res: ServerResponse, response: Response) => {
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
  authOrigin: process.env.AUTH_ORIGIN ?? "",
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
        res.end(
          JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
        );
      });
  });
}).listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
