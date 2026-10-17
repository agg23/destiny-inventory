export interface ArtifactIndex {
  manifestVersion: string;
  files: Record<string, string[]>;
}

export interface ArtifactLoader {
  index: () => Promise<ArtifactIndex | undefined>;
  raw: (file: string) => Promise<ArrayBuffer | undefined>;
}

/** Serves raw files from read and decodes index.json from it */
export const loaderFrom = (
  read: (file: string) => Promise<ArrayBuffer | undefined>,
): ArtifactLoader => ({
  index: async () => {
    const body = await read("index.json");

    return body
      ? (JSON.parse(new TextDecoder().decode(body)) as ArtifactIndex)
      : undefined;
  },
  raw: read,
});
