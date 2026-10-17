export const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Capitalizes the first letter */
export const sentence = (text: string): string =>
  text.replace(/\p{L}/u, (first) => first.toUpperCase());

/** Bungie's {var:hash} token, the values ship in the profile */
export const VARIABLE = /\{var:(\d+)\}/g;
