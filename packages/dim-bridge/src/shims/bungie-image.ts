export type BungieImagePath = string;

// Real module is a React component. Store factory only needs the path helper
export const bungieNetPath = (src: BungieImagePath): string => {
  if (!src) {
    return "";
  }

  return src.startsWith("~") ? src.slice(1) : `https://www.bungie.net${src}`;
};
