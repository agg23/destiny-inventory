import type { ArtifactIndex } from "./config.ts";

const BASE = "/artifacts";

const fetchChunk = async <T>(file: string): Promise<T> => {
  const response = await fetch(`${BASE}/${file}`);

  if (!response.ok) {
    throw new Error(`Artifact ${file} failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const filesFor = (index: ArtifactIndex, name: string): string[] => {
  const files = index.files[name];

  if (!files || files.length === 0) {
    throw new Error(`No ${name} artifact in index`);
  }

  return files;
};

export const hasArtifact = (index: ArtifactIndex, name: string): boolean =>
  Boolean(index.files[name]?.length);

// A single static asset is size capped
export const fetchRecords = async <T>(
  index: ArtifactIndex,
  name: string,
): Promise<T[]> => {
  const chunks = await Promise.all(
    filesFor(index, name).map((file) => fetchChunk<T[]>(file)),
  );

  return chunks.flat();
};

export const fetchTable = async <T>(
  index: ArtifactIndex,
  name: string,
): Promise<T> => {
  const [file] = filesFor(index, name);

  return fetchChunk<T>(file!);
};
