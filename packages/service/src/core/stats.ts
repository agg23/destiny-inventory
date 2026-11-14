// D1 caps a row at 2MB
export const MAX_CHUNK_LENGTH = 1_000_000;

/** Every chunk is one fixed wall clock bucket this long */
export const STAT_BUCKET = 300_000;

/** Most chunks one pull returns. The client asks again while `more` is set */
export const STAT_PAGE = 100;

/** A bucket of recorded profile changes, the client's JSON as sent */
export interface StatChunk {
  startsAt: number;
  endsAt: number;
  body: string;
  updatedAt: number;
}

export type StatChunkWrite = Omit<StatChunk, "updatedAt">;

/** A chunk as stored, the body gzipped. Two recorders' copies of a bucket keep the longer `length` */
export interface StoredChunk {
  startsAt: number;
  endsAt: number;
  gzipped: Uint8Array;
  // Of the JSON before gzip
  length: number;
  updatedAt: number;
}

/** The last chunk a pull was handed. Chunks are ordered by updatedAt, then startsAt */
export interface StatCursor {
  updatedAt: number;
  startsAt: number;
}

export interface StatStore {
  read: (
    membershipId: string,
    after: StatCursor,
    limit: number,
  ) => Promise<StoredChunk[]>;
  readOne: (
    membershipId: string,
    startsAt: number,
  ) => Promise<StoredChunk | undefined>;
  write: (
    membershipId: string,
    chunk: Omit<StoredChunk, "updatedAt">,
    now: number,
  ) => Promise<void>;
}

export const isAfter = (chunk: StatCursor, cursor: StatCursor): boolean =>
  chunk.updatedAt > cursor.updatedAt ||
  (chunk.updatedAt === cursor.updatedAt && chunk.startsAt > cursor.startsAt);

export const gzip = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(
    await new Response(
      new Response(text).body!.pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );

export const gunzip = (bytes: Uint8Array): Promise<string> =>
  new Response(
    new Response(bytes as Uint8Array<ArrayBuffer>).body!.pipeThrough(
      new DecompressionStream("gzip"),
    ),
  ).text();

const isAutotag = (change: unknown): boolean =>
  typeof change === "object" &&
  change !== null &&
  "kind" in change &&
  change.kind === "autotag";

/** The winning copy of a bucket plus the autotag entries only the losing copy has */
export const mergeAutotag = <T>(winner: T[], loser: T[]): T[] => {
  const seen = new Set(winner.map((change) => JSON.stringify(change)));
  const missing = loser.filter(
    (change) => isAutotag(change) && !seen.has(JSON.stringify(change)),
  );

  if (missing.length === 0) {
    return winner;
  }

  return [...winner, ...missing];
};

const isArrayJson = (body: string): boolean => {
  try {
    return Array.isArray(JSON.parse(body));
  } catch {
    return false;
  }
};

/** Undefined when the body is not one well formed chunk */
export const parseChunk = (raw: unknown): StatChunkWrite | undefined => {
  const { startsAt, endsAt, body } = (raw ?? {}) as Record<string, unknown>;

  if (
    typeof startsAt !== "number" ||
    !Number.isSafeInteger(startsAt) ||
    startsAt % STAT_BUCKET !== 0 ||
    endsAt !== startsAt + STAT_BUCKET ||
    typeof body !== "string" ||
    body.length > MAX_CHUNK_LENGTH ||
    !isArrayJson(body)
  ) {
    return undefined;
  }

  return { startsAt, endsAt, body };
};
