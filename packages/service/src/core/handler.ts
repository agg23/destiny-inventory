import { fetchProfile } from "./bungie.ts";
import type { ArtifactLoader } from "./loader.ts";
import { exchangeCode, refreshTokens, type OAuthConfig } from "./oauth.ts";
import { buildRefresh, type RefreshRequest } from "./refresh.ts";

export interface ServiceConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string;
  allowedOrigin: string;
  loader: ArtifactLoader;
}

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

const gzipped = (value: unknown, origin: string): Response => {
  const body = new Blob([JSON.stringify(value)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      ...cors(origin),
    },
  });
};

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
        const artifacts = await config.loader.load();

        return json({ ok: true, manifestVersion: artifacts.version }, config.allowedOrigin);
      }

      if (pathname === "/auth/token" && request.method === "POST") {
        const { code } = (await request.json()) as { code: string };

        return json(await exchangeCode(oauth, code), config.allowedOrigin);
      }

      if (pathname === "/auth/refresh" && request.method === "POST") {
        const { refreshToken } = (await request.json()) as { refreshToken: string };

        return json(await refreshTokens(oauth, refreshToken), config.allowedOrigin);
      }

      if (pathname === "/refresh" && request.method === "POST") {
        const body = (await request.json()) as RefreshRequest;
        const artifacts = await config.loader.load();

        const profile = await fetchProfile(
          { membershipType: body.membershipType, membershipId: body.membershipId },
          config.apiKey,
          body.accessToken,
        );

        return gzipped(
          buildRefresh(artifacts, profile, body.knownHashes, body.knownPlugSets),
          config.allowedOrigin,
        );
      }

      return json({ error: "Not found" }, config.allowedOrigin, 404);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      return json({ error: message }, config.allowedOrigin, 500);
    }
  };
};
