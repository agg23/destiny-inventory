const DIM_GG = "https://dim.gg/";

// Taken from DIM's loadout-import.ts
const SHARE_LINK = /^(?:(?:https?:\/\/)?dim\.gg\/)?([a-z0-9]{7,})(?:\/.*)?$/;

// The page's "Open in DIM" links hold the full loadout
const LOADOUT_HREF = /href="([^"]*\/loadouts\?[^"]*)"/;

export interface ShareStore {
  read: (shareId: string) => Promise<object | undefined>;
  write: (shareId: string, loadout: object, now: number) => Promise<void>;
}

export type SharedLoadout =
  | { kind: "found"; loadout: object }
  | { kind: "missing" }
  | { kind: "unreadable" };

/** The share id from a dim.gg link, or a bare id */
export const parseShareId = (link: string): string | undefined =>
  link.trim().match(SHARE_LINK)?.[1];

/** The DIM API loadout embedded in a dim.gg share page */
export const parseSharePage = (html: string): object | undefined => {
  const href = html.match(LOADOUT_HREF)?.[1];

  if (!href) {
    return undefined;
  }

  try {
    const raw = new URL(href).searchParams.get("loadout");

    if (!raw) {
      return undefined;
    }

    const loadout: unknown = JSON.parse(raw);

    if (typeof loadout !== "object" || !loadout || Array.isArray(loadout)) {
      return undefined;
    }

    return loadout;
  } catch {
    return undefined;
  }
};

/** A share's loadout, from the store when held, otherwise from dim.gg */
export const fetchSharedLoadout = async (
  shareId: string,
  store: ShareStore,
): Promise<SharedLoadout> => {
  const held = await store.read(shareId);

  if (held) {
    return { kind: "found", loadout: held };
  }

  const response = await fetch(`${DIM_GG}${shareId}`);

  if (response.status === 404) {
    return { kind: "missing" };
  }

  if (!response.ok) {
    throw new Error(`dim.gg ${response.status} on ${shareId}`);
  }

  const loadout = parseSharePage(await response.text());

  if (!loadout) {
    return { kind: "unreadable" };
  }

  await store.write(shareId, loadout, Date.now());

  return { kind: "found", loadout };
};
