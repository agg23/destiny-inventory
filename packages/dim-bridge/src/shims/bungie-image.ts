export type BungieImagePath = string;

// The real module is a React component; only the path helper is reachable from the store factory
export const bungieNetPath = (src: BungieImagePath): string => {
  if (!src) {
    return "";
  }

  return src.startsWith("~") ? src.slice(1) : `https://www.bungie.net${src}`;
};
