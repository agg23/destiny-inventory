import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export const mb = (n: number): string => `${(n / 1_048_576).toFixed(2)} MB`;

const contentHash = (body: Buffer): string =>
  createHash("sha256").update(body).digest("hex").slice(0, 16);

// Static assets cap a single file, and the edge compresses on the way out
const CHUNK_BYTES = 15 * 1_048_576;

const writeOne = async (
  dir: string,
  name: string,
  value: unknown,
  part?: number,
) => {
  const raw = Buffer.from(JSON.stringify(value));
  const suffix = part === undefined ? "" : `-${part}`;
  const file = `${name}${suffix}.${contentHash(raw)}.json`;

  await writeFile(join(dir, file), raw);

  return { file, raw: raw.length };
};

// Ship plain: the edge re-compresses a body that already carries Content-Encoding
export const writeArtifact = async (
  dir: string,
  name: string,
  value: unknown,
): Promise<{ files: string[]; raw: number }> => {
  if (!Array.isArray(value)) {
    const only = await writeOne(dir, name, value);

    return { files: [only.file], raw: only.raw };
  }

  const perRecord =
    Buffer.byteLength(JSON.stringify(value)) / Math.max(value.length, 1);
  const perChunk = Math.max(
    1,
    Math.floor(CHUNK_BYTES / Math.max(perRecord, 1)),
  );

  const files: string[] = [];
  let raw = 0;
  let part = 0;

  for (let start = 0; start < value.length; start += perChunk) {
    const written = await writeOne(
      dir,
      name,
      value.slice(start, start + perChunk),
      part,
    );

    files.push(written.file);
    raw += written.raw;
    part += 1;
  }

  return { files, raw };
};
