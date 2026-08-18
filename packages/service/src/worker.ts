import { createHandler, type ArtifactIndex, type ArtifactLoader } from "./core/index.ts";

interface Assets {
  fetch: (request: Request) => Promise<Response>;
}

interface Env {
  ASSETS: Assets;
  BUNGIE_API_KEY: string;
  BUNGIE_CLIENT_ID: string;
  BUNGIE_CLIENT_SECRET: string;
  ALLOWED_ORIGIN?: string;
}

// Artifacts ship as static assets, so the isolate never holds a definition table. Only the
// index is read here; the chunks are fetched by the client straight from the asset handler
const assetLoader = (env: Env, origin: string): ArtifactLoader => {
  const read = async (file: string): Promise<ArrayBuffer | undefined> => {
    const response = await env.ASSETS.fetch(new Request(`${origin}/artifacts/${file}`));

    return response.ok ? await response.arrayBuffer() : undefined;
  };

  return {
    index: async () => {
      const body = await read("index.json");

      return body ? (JSON.parse(new TextDecoder().decode(body)) as ArtifactIndex) : undefined;
    },
    raw: read,
  };
};

export default {
  fetch: async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      const asset = await env.ASSETS.fetch(request);

      // Client routes such as /auth/callback have no asset of their own. Ask for the root
      // rather than /index.html, which the asset handler 307s to / and drops the query
      if (asset.status === 404 || asset.status === 307 || asset.status === 308) {
        return env.ASSETS.fetch(new Request(new URL("/", url), request));
      }

      return asset;
    }

    const handler = createHandler({
      apiKey: env.BUNGIE_API_KEY,
      clientId: env.BUNGIE_CLIENT_ID,
      clientSecret: env.BUNGIE_CLIENT_SECRET,
      allowedOrigin: env.ALLOWED_ORIGIN ?? url.origin,
      authOrigin: url.origin,
      loader: assetLoader(env, url.origin),
    });

    const inner = new Request(
      new URL(`${url.pathname.slice("/api".length)}${url.search}`, url),
      request,
    );

    return handler(inner);
  },
};
