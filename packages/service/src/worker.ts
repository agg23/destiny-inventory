import {
  createHandler,
  refresh,
  type ArtifactIndex,
  type ArtifactLoader,
  type Reference,
  type Store,
} from "./core/index.ts";

interface Assets {
  fetch: (request: Request) => Promise<Response>;
}

interface Env {
  ASSETS: Assets;
  BUNGIE_API_KEY: string;
  BUNGIE_CLIENT_ID: string;
  BUNGIE_CLIENT_SECRET: string;
  ALLOWED_ORIGIN?: string;
  /** Bound only once a KV namespace exists, and the baseline is skipped until it does */
  BASELINE?: Store;
  /** Any public profile. It is read at reset, when every account still has its full week */
  BASELINE_MEMBERSHIP?: string;
}

// "3/4611686018468466126", which is the platform and the Destiny membership
const reference = (env: Env): Reference | undefined => {
  const [type, id] = (env.BASELINE_MEMBERSHIP ?? "").split("/");

  return type && id
    ? { membershipType: Number(type), membershipId: id }
    : undefined;
};

const baselineOf = (env: Env) => {
  const who = reference(env);

  return env.BASELINE && who
    ? { store: env.BASELINE, reference: who }
    : undefined;
};

// Artifacts ship as static assets, so the isolate never holds a definition table. Only the
// index is read here; the chunks are fetched by the client straight from the asset handler
const assetLoader = (env: Env, origin: string): ArtifactLoader => {
  const read = async (file: string): Promise<ArrayBuffer | undefined> => {
    const response = await env.ASSETS.fetch(
      new Request(`${origin}/artifacts/${file}`),
    );

    return response.ok ? await response.arrayBuffer() : undefined;
  };

  return {
    index: async () => {
      const body = await read("index.json");

      return body
        ? (JSON.parse(new TextDecoder().decode(body)) as ArtifactIndex)
        : undefined;
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
      if (
        asset.status === 404 ||
        asset.status === 307 ||
        asset.status === 308
      ) {
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
      baseline: baselineOf(env),
    });

    const inner = new Request(
      new URL(`${url.pathname.slice("/api".length)}${url.search}`, url),
      request,
    );

    return handler(inner);
  },

  // Fires after each daily reset; a run inside an already-captured week is a no-op
  scheduled: async (_event: unknown, env: Env): Promise<void> => {
    const held = baselineOf(env);

    if (!held) {
      return;
    }

    await refresh(held.store, env.BUNGIE_API_KEY, held.reference, new Date());
  },
};
