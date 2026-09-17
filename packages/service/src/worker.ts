import {
  createHandler,
  refresh,
  type ArtifactIndex,
  type ArtifactLoader,
  type Reference,
  type Store,
  type TagStore,
} from "./core/index.ts";

interface Assets {
  fetch: (request: Request) => Promise<Response>;
}

interface Statement {
  bind: (...values: unknown[]) => Statement;
  all: <T>() => Promise<{ results: T[] }>;
}

interface Database {
  prepare: (query: string) => Statement;
  batch: (statements: Statement[]) => Promise<unknown>;
}

interface Env {
  ASSETS: Assets;
  BUNGIE_API_KEY: string;
  BUNGIE_CLIENT_ID: string;
  BUNGIE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN?: string;
  /** Bound only once a KV namespace exists, and the baseline is skipped until it does */
  BASELINE?: Store;
  TAGS: Database;
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

interface DefRow {
  id: string;
  label: string;
  color: string;
  position: number;
  removed: number;
  updated_at: number;
}

interface ItemRow {
  instance_id: string;
  item_hash: number;
  tag_id: string;
  removed: number;
  updated_at: number;
}

const READ_DEFS =
  "SELECT id, label, color, position, removed, updated_at FROM tag_defs WHERE membership_id = ? AND updated_at > ?";

const READ_ITEMS =
  "SELECT instance_id, item_hash, tag_id, removed, updated_at FROM item_tags WHERE membership_id = ? AND updated_at > ?";

const WRITE_DEF = `INSERT INTO tag_defs (membership_id, id, label, color, position, removed, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (membership_id, id) DO UPDATE SET
  label = excluded.label,
  color = excluded.color,
  position = excluded.position,
  removed = excluded.removed,
  updated_at = excluded.updated_at`;

const WRITE_ITEM = `INSERT INTO item_tags (membership_id, instance_id, item_hash, tag_id, removed, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (membership_id, instance_id, tag_id) DO UPDATE SET
  item_hash = excluded.item_hash,
  removed = excluded.removed,
  updated_at = excluded.updated_at`;

const tagStore = (db: Database): TagStore => ({
  read: async (membershipId, since) => {
    const [defs, items] = await Promise.all([
      db.prepare(READ_DEFS).bind(membershipId, since).all<DefRow>(),
      db.prepare(READ_ITEMS).bind(membershipId, since).all<ItemRow>(),
    ]);

    return {
      defs: defs.results.map((row) => ({
        id: row.id,
        label: row.label,
        color: row.color,
        position: row.position,
        removed: row.removed === 1,
        updatedAt: row.updated_at,
      })),
      items: items.results.map((row) => ({
        instanceId: row.instance_id,
        itemHash: row.item_hash,
        tagId: row.tag_id,
        removed: row.removed === 1,
        updatedAt: row.updated_at,
      })),
    };
  },

  write: async (membershipId, changes, now) => {
    const statements = [
      ...changes.defs.map((def) =>
        db
          .prepare(WRITE_DEF)
          .bind(
            membershipId,
            def.id,
            def.label,
            def.color,
            def.position,
            def.removed ? 1 : 0,
            now,
          ),
      ),
      ...changes.items.map((item) =>
        db
          .prepare(WRITE_ITEM)
          .bind(
            membershipId,
            item.instanceId,
            item.itemHash,
            item.tagId,
            item.removed ? 1 : 0,
            now,
          ),
      ),
    ];

    if (statements.length === 0) {
      return;
    }

    await db.batch(statements);
  },
});

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
      sessionSecret: env.SESSION_SECRET,
      allowedOrigin: env.ALLOWED_ORIGIN ?? url.origin,
      authOrigin: url.origin,
      loader: assetLoader(env, url.origin),
      baseline: baselineOf(env),
      tags: tagStore(env.TAGS),
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
