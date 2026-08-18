import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";

// Perk and stat lookups happen deep in the render tree, and the tables are built once per load
let current: D2ManifestDefinitions | undefined = undefined;

export const setDefs = (built: D2ManifestDefinitions) => {
  current = built;
};

export const defs = (): D2ManifestDefinitions | undefined => current;
