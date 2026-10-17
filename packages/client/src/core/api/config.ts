import type { ArtifactIndex } from "@dvm/service";

import { cached } from "./cache.ts";

interface ClientConfig {
  apiKey: string;
  clientId: string;
  authOrigin?: string;
  artifacts: ArtifactIndex;
}

// Fetched to change credentials without a rebuild
export const loadConfig = cached(async (): Promise<ClientConfig> => {
  const response = await fetch("/api/config");

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
