import {
  createHandler,
  loaderFrom,
  refresh,
  type ArtifactLoader,
  type Membership,
  type NoteKind,
  type NoteStore,
  type StatStore,
  type Store,
  type TagStore,
} from "./core/index.ts";

interface Assets {
  fetch: (request: Request) => Promise<Response>;
}

interface Statement {
  bind: (...values: unknown[]) => Statement;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
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
  BASELINE?: Store;
  TAGS: Database;
  // Any public profile
  BASELINE_MEMBERSHIP?: string;
}

// "3/4611686018468466126" - platform and Destiny membership id
const reference = (env: Env): Membership | undefined => {
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

interface NoteRow {
  kind: NoteKind;
  target_id: string;
  item_hash: number | null;
  body: string;
  removed: number;
  updated_at: number;
}

const READ_NOTES =
  "SELECT kind, target_id, item_hash, body, removed, updated_at FROM notes WHERE membership_id = ? AND updated_at > ?";

const WRITE_NOTE = `INSERT INTO notes (membership_id, kind, target_id, item_hash, body, removed, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (membership_id, kind, target_id) DO UPDATE SET
  item_hash = excluded.item_hash,
  body = excluded.body,
  removed = excluded.removed,
  updated_at = excluded.updated_at`;

const noteStore = (db: Database): NoteStore => ({
  read: async (membershipId, since) => {
    const notes = await db
      .prepare(READ_NOTES)
      .bind(membershipId, since)
      .all<NoteRow>();

    return notes.results.map((row) => ({
      kind: row.kind,
      targetId: row.target_id,
      itemHash: row.item_hash ?? undefined,
      body: row.body,
      removed: row.removed === 1,
      updatedAt: row.updated_at,
    }));
  },

  write: async (membershipId, change, now) => {
    await db
      .prepare(WRITE_NOTE)
      .bind(
        membershipId,
        change.kind,
        change.targetId,
        change.itemHash ?? null,
        change.body,
        change.removed ? 1 : 0,
        now,
      )
      .run();
  },
});

interface ChunkRow {
  starts_at: number;
  ends_at: number;
  // D1 returns BLOBs as number arrays
  body: number[];
  body_length: number;
  updated_at: number;
}

const READ_CHUNKS = `SELECT starts_at, ends_at, body, body_length, updated_at FROM stat_chunks
WHERE membership_id = ? AND (updated_at > ? OR (updated_at = ? AND starts_at > ?))
ORDER BY updated_at, starts_at
LIMIT ?`;

const WRITE_CHUNK = `INSERT INTO stat_chunks (membership_id, starts_at, ends_at, body, body_length, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (membership_id, starts_at) DO UPDATE SET
  ends_at = excluded.ends_at,
  body = excluded.body,
  body_length = excluded.body_length,
  updated_at = excluded.updated_at
WHERE excluded.body_length >= stat_chunks.body_length`;

const statStore = (db: Database): StatStore => ({
  read: async (membershipId, after, limit) => {
    const chunks = await db
      .prepare(READ_CHUNKS)
      .bind(
        membershipId,
        after.updatedAt,
        after.updatedAt,
        after.startsAt,
        limit,
      )
      .all<ChunkRow>();

    return chunks.results.map((row) => ({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      gzipped: new Uint8Array(row.body),
      length: row.body_length,
      updatedAt: row.updated_at,
    }));
  },

  write: async (membershipId, chunk, now) => {
    await db
      .prepare(WRITE_CHUNK)
      .bind(
        membershipId,
        chunk.startsAt,
        chunk.endsAt,
        chunk.gzipped,
        chunk.length,
        now,
      )
      .run();
  },
});

// Only the index is read here. The client fetches chunks straight from the asset handler
const assetLoader = (env: Env, origin: string): ArtifactLoader => {
  const read = async (file: string): Promise<ArrayBuffer | undefined> => {
    const response = await env.ASSETS.fetch(
      new Request(`${origin}/artifacts/${file}`),
    );

    return response.ok ? await response.arrayBuffer() : undefined;
  };

  return loaderFrom(read);
};

export default {
  fetch: async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      const asset = await env.ASSETS.fetch(request);

      // Client routes like /auth/callback have no asset. /index.html 307s to / and drops the query
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
      notes: noteStore(env.TAGS),
      stats: statStore(env.TAGS),
    });

    const inner = new Request(
      new URL(`${url.pathname.slice("/api".length)}${url.search}`, url),
      request,
    );

    return handler(inner);
  },

  // Runs after each daily reset. No-op once the week is captured
  scheduled: async (_event: unknown, env: Env): Promise<void> => {
    const held = baselineOf(env);

    if (!held) {
      return;
    }

    await refresh(held.store, env.BUNGIE_API_KEY, held.reference, new Date());
  },
};
