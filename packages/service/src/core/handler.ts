import { readBaseline, type Store } from "./baseline.ts";
import type { Membership } from "./bungie.ts";
import type { ArtifactLoader } from "./loader.ts";
import { parseNote, type NoteStore } from "./notes.ts";
import {
  exchangeCode,
  refreshTokens,
  type OAuthConfig,
  type Tokens,
} from "./oauth.ts";
import {
  mintSession,
  readSession,
  SESSION_MS,
  type Session,
} from "./session.ts";
import { parseWrite, type TagStore } from "./tags.ts";

export interface ServiceConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  allowedOrigin: string;
  /** The one origin registered with Bungie for OAuth */
  authOrigin: string;
  loader: ArtifactLoader;
  baseline?: { store: Store; reference: Membership };
  tags: TagStore;
  notes: NoteStore;
}

// Blocks path traversal
const ARTIFACT_NAME = /^[A-Za-z0-9._-]+$/;

const BEARER = "Bearer ";

const cors = (origin: string): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const withSession = async (tokens: Tokens) => ({
    ...tokens,
    session: await mintSession(
      config.sessionSecret,
      tokens.membership_id,
      Date.now() + SESSION_MS,
    ),
  });

  const sessionOf = (request: Request): Promise<Session | undefined> => {
    const header = request.headers.get("Authorization") ?? "";

    if (!header.startsWith(BEARER)) {
      return Promise.resolve(undefined);
    }

    return readSession(
      config.sessionSecret,
      header.slice(BEARER.length),
      Date.now(),
    );
  };

  // Membership from the verified session, never the request
  const sync = async <Snapshot, Change>(
    request: Request,
    store: {
      read: (membershipId: string, since: number) => Promise<Snapshot>;
      write: (
        membershipId: string,
        change: Change,
        now: number,
      ) => Promise<void>;
    },
    present: (snapshot: Snapshot) => object,
    parse: (body: unknown) => Change | undefined,
    invalid: string,
  ): Promise<Response> => {
    const session = await sessionOf(request);

    if (!session) {
      return json({ error: "Sign in required" }, config.allowedOrigin, 401);
    }

    if (request.method === "GET") {
      const raw = Number(new URL(request.url).searchParams.get("since"));
      const since = Number.isSafeInteger(raw) && raw > 0 ? raw : 0;

      return json(
        {
          ...present(await store.read(session.membershipId, since)),
          now: Date.now(),
        },
        config.allowedOrigin,
      );
    }

    const change = parse(await request.json());

    if (!change) {
      return json({ error: invalid }, config.allowedOrigin, 400);
    }

    const now = Date.now();
    await store.write(session.membershipId, change, now);

    return json({ now }, config.allowedOrigin);
  };

  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(undefined, {
        status: 204,
        headers: cors(config.allowedOrigin),
      });
    }

    try {
      if (pathname === "/health") {
        return json({ ok: true }, config.allowedOrigin);
      }

      // Credentials are public. Index included to avoid a separately cached request going stale
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

      if (pathname === "/baseline") {
        const held = config.baseline
          ? await readBaseline(config.baseline.store, new Date())
          : undefined;

        return json(held ?? { rows: {} }, config.allowedOrigin);
      }

      // Node adapter only. Workers serves these as static assets
      if (pathname.startsWith("/artifacts/")) {
        const file = pathname.slice("/artifacts/".length);

        if (!ARTIFACT_NAME.test(file)) {
          return json(
            { error: "Bad artifact name" },
            config.allowedOrigin,
            400,
          );
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

      if (
        pathname === "/tags" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        return sync(
          request,
          config.tags,
          (snapshot) => snapshot,
          parseWrite,
          "Bad tag changes",
        );
      }

      if (
        pathname === "/notes" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        return sync(
          request,
          config.notes,
          (notes) => ({ notes }),
          parseNote,
          "Bad note",
        );
      }

      if (pathname === "/auth/token" && request.method === "POST") {
        const { code } = (await request.json()) as { code: string };

        return json(
          await withSession(await exchangeCode(oauth, code)),
          config.allowedOrigin,
        );
      }

      if (pathname === "/auth/refresh" && request.method === "POST") {
        const { refreshToken } = (await request.json()) as {
          refreshToken: string;
        };

        return json(
          await withSession(await refreshTokens(oauth, refreshToken)),
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
