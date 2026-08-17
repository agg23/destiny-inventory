export interface ArtifactIndex {
  manifestVersion: string;
  files: Record<string, string[]>;
}

export interface ClientConfig {
  apiKey: string;
  clientId: string;
  artifacts: ArtifactIndex;
}

let pending: Promise<ClientConfig> | undefined = undefined;

// Served rather than built in, so changing credentials never needs a client rebuild
export const loadConfig = (): Promise<ClientConfig> => {
  pending ??= fetch("/api/config").then(async (response) => {
    if (!response.ok) {
      throw new Error(`Config failed: ${response.status}`);
    }

    const config = (await response.json()) as ClientConfig;

    if (!config.apiKey) {
      throw new Error("Service has no Bungie API key configured");
    }

    if (!config.artifacts) {
      throw new Error("Service has no artifacts built");
    }

    return config;
  });

  return pending;
};
