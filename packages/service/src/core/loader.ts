export interface ArtifactIndex {
  manifestVersion: string;
  files: Record<string, string[]>;
}

export interface ArtifactLoader {
  index: () => Promise<ArtifactIndex | undefined>;
  raw: (file: string) => Promise<ArrayBuffer | undefined>;
}
