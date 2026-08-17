import type { Tables } from "@dvm/defs-core";

export interface Artifacts {
  version: string;
  tables: Tables;
}

export interface ArtifactLoader {
  load: () => Promise<Artifacts>;
  raw: (table: string) => Promise<Uint8Array | undefined>;
}
