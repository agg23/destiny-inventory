import type { ArtifactLoader } from "./loader.ts";
import { exchangeCode, refreshTokens, type OAuthConfig } from "./oauth.ts";

export interface ServiceConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string;
  allowedOrigin: string;
  /** Where OAuth has to start, which is the one origin Bungie has registered */
  authOrigin: string;
  loader: ArtifactLoader;
}

// Content-hashed names only, so a request can never walk out of the artifact directory
const ARTIFACT_NAME = /^[A-Za-z0-9._-]+$/;

const cors = (origin: string): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
});

const json = (value: unknown, origin: string, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

export const createHandler = (config: ServiceConfig) => {
  const oauth: OAuthConfig = {
    apiKey: config.apiKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  };

  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(undefined, { status: 204, headers: cors(config.allowedOrigin) });
    }

    try {
      if (pathname === "/health") {
        return json({ ok: true }, config.allowedOrigin);
      }

      // Credentials are public, and the artifact index rides along so the client learns the
      // current manifest without a separately cacheable request that could go stale
      if (pathname === "/config") {
        const index = await config.loader.index();

        return json(
          {
            apiKey: config.apiKey,
            clientId: config.clientId,
            authOrigin: config.authOrigin,
            artifacts: index,
          },
          config.allowedOrigin,
        );
      }

      // Only the Node adapter reaches this. On Workers the files are static assets, served
      // and compressed by the platform, because re-wrapping them broke Content-Encoding
      if (pathname.startsWith("/artifacts/")) {
        const file = pathname.slice("/artifacts/".length);

        if (!ARTIFACT_NAME.test(file)) {
          return json({ error: "Bad artifact name" }, config.allowedOrigin, 400);
        }

        const body = await config.loader.raw(file);

        if (!body) {
          return json({ error: "No such artifact" }, config.allowedOrigin, 404);
        }

        return new Response(body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=31536000, immutable",
            ...cors(config.allowedOrigin),
          },
        });
      }

      if (pathname === "/auth/token" && request.method === "POST") {
        const { code } = (await request.json()) as { code: string };

        return json(await exchangeCode(oauth, code), config.allowedOrigin);
      }

      if (pathname === "/auth/refresh" && request.method === "POST") {
        const { refreshToken } = (await request.json()) as { refreshToken: string };

        return json(await refreshTokens(oauth, refreshToken), config.allowedOrigin);
      }

      return json({ error: "Not found" }, config.allowedOrigin, 404);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      return json({ error: message }, config.allowedOrigin, 500);
    }
  };
};
