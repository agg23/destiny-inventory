import { unenhancedVersion } from "app/utils/perk-utils";
import { createSignal } from "solid-js";

import { onIdle } from "../idle.ts";
import { CLARITY, openStore, type DefStore } from "../profile/store.ts";
import { HOUR } from "../time.ts";

const CLARITY_BASE = "https://database-clarity.github.io/Live-Clarity-Database";
const VERSION_URL = `${CLARITY_BASE}/versions.json`;
const DESCRIPTIONS_URL = `${CLARITY_BASE}/descriptions/clarity.json`;

const STORED_KEY = "perks";

const ENHANCED_ARROW = "🡅";

// No font on macOS has these
const readable = (text: string): string =>
  text
    .replaceAll("🠚", "→")
    .replaceAll("⇒", "→")
    .replace(/▛\s*/g, "“")
    .replace(/\s*▟/g, "”");

// Taken from DIM's ClarityDescriptions
const NUMBER = /(?:^|\b)[+-]?(?:\d*\.)?\d+(?:[xs]|ms|HP)?(?:[%°+]|\b|$)/g;

const PIPE = /\s*\|\s*/;

const BULLET = /^•\s*/;

/** PvP values, Clarity's bold, and the item names Clarity colors by category */
export type ClarityTone = "pvp" | "bold" | "named";

const TONES: Record<string, ClarityTone> = {
  pvp: "pvp",
  bold: "bold",
  yellow: "named",
  blue: "named",
  green: "named",
  purple: "named",
};

const ICONS = [
  "kinetic",
  "arc",
  "solar",
  "void",
  "stasis",
  "strand",
  "primary",
  "special",
  "heavy",
  "barrier",
  "overload",
  "unstoppable",
  "hunter",
  "titan",
  "warlock",
] as const;

export type ClarityIcon = (typeof ICONS)[number];

export type ClaritySpan =
  | { kind: "text"; text: string; tones: ClarityTone[] }
  | { kind: "number"; text: string }
  | { kind: "enhanced"; text: string }
  | { kind: "pipe" }
  | { kind: "icon"; icon: ClarityIcon };

/** One line of a perk's Clarity text, a blank line when it has no spans */
export interface ClarityLine {
  bullet: boolean;
  spans: ClaritySpan[];
}

interface RawContent {
  text?: string;
  classNames?: string[];
  link?: string;
}

interface RawLine {
  linesContent?: RawContent[];
  classNames?: string[];
}

interface RawPerk {
  descriptions: { en?: RawLine[] } | null;
}

interface StoredClarity {
  version: number;
  raw: Record<string, RawPerk>;
}

type Piece =
  | { kind: "text"; text: string; tones: ClarityTone[] }
  | { kind: "arrow" }
  | { kind: "icon"; icon: ClarityIcon };

const tonesOf = (classNames: string[] | undefined): ClarityTone[] =>
  (classNames ?? []).flatMap((name) => {
    const tone = TONES[name];

    return tone === undefined ? [] : [tone];
  });

const iconOf = (classNames: string[] | undefined): ClarityIcon | undefined =>
  (classNames ?? []).find((name): name is ClarityIcon =>
    (ICONS as readonly string[]).includes(name),
  );

const hasNumber = (text: string): boolean =>
  [...text.matchAll(NUMBER)].length > 0;

const piecesOf = (line: RawLine): Piece[] => {
  const lineTones = tonesOf(line.classNames);
  const pieces: Piece[] = [];

  for (const content of line.linesContent ?? []) {
    if (content.text === undefined) {
      const icon = iconOf(content.classNames);

      if (icon !== undefined) {
        pieces.push({ kind: "icon", icon });
      }

      continue;
    }

    const tones = [...new Set([...lineTones, ...tonesOf(content.classNames)])];
    const labeled = content.classNames?.includes("pvp")
      ? content.text.replace(/^\[/, "[PvP ")
      : content.text;
    const parts = readable(labeled).split(ENHANCED_ARROW);

    for (let at = 0; at < parts.length; at += 1) {
      if (at > 0) {
        pieces.push({ kind: "arrow" });
      }

      if (parts[at] !== "") {
        pieces.push({ kind: "text", text: parts[at]!, tones });
      }
    }
  }

  return pieces;
};

const segmentSpans = (text: string, tones: ClarityTone[]): ClaritySpan[] => {
  if (text === "") {
    return [];
  }

  if (tones.length > 0) {
    return [{ kind: "text", text, tones }];
  }

  const spans: ClaritySpan[] = [];
  let start = 0;

  for (const match of text.matchAll(NUMBER)) {
    if (match.index > start) {
      spans.push({ kind: "text", text: text.slice(start, match.index), tones });
    }

    spans.push({ kind: "number", text: match[0] });
    start = match.index + match[0].length;
  }

  if (start < text.length) {
    spans.push({ kind: "text", text: text.slice(start), tones });
  }

  return spans;
};

const plainSpans = (text: string, tones: ClarityTone[]): ClaritySpan[] =>
  text
    .split(PIPE)
    .flatMap((segment, at): ClaritySpan[] => [
      ...(at > 0 ? [{ kind: "pipe" } as const] : []),
      ...segmentSpans(segment, tones),
    ]);

/** Resolves Clarity's spans, with each enhanced arrow marking the next number or else the rest of its line */
export const parseLine = (line: RawLine): ClarityLine => {
  if (line.classNames?.includes("spacer")) {
    return { bullet: false, spans: [] };
  }

  const pieces = piecesOf(line);
  const spans: ClaritySpan[] = [];
  let nextNumber = false;
  let restOfLine = false;

  for (let at = 0; at < pieces.length; at += 1) {
    const piece = pieces[at]!;

    if (piece.kind === "icon") {
      spans.push(piece);

      continue;
    }

    if (piece.kind === "arrow") {
      const numberAhead = pieces
        .slice(at + 1)
        .some((later) => later.kind === "text" && hasNumber(later.text));

      nextNumber = numberAhead;
      restOfLine = !numberAhead;

      continue;
    }

    if (restOfLine) {
      spans.push({ kind: "enhanced", text: piece.text });

      continue;
    }

    if (nextNumber) {
      const [match] = [...piece.text.matchAll(NUMBER)];

      if (match === undefined) {
        spans.push(...plainSpans(piece.text, piece.tones));

        continue;
      }

      nextNumber = false;
      const end = match.index + match[0].length;

      spans.push(...plainSpans(piece.text.slice(0, match.index), piece.tones));
      spans.push({ kind: "enhanced", text: match[0] });
      spans.push(...plainSpans(piece.text.slice(end), piece.tones));

      continue;
    }

    spans.push(...plainSpans(piece.text, piece.tones));
  }

  // A dropped arrow leaves its trailing space
  const first = spans[0];
  let bullet = false;

  if (first !== undefined && "text" in first) {
    const trimmed = first.text.trimStart();
    bullet = BULLET.test(trimmed);
    const text = trimmed.replace(BULLET, "");

    if (text === "") {
      spans.shift();
    } else {
      spans[0] = { ...first, text };
    }
  }

  return { bullet, spans };
};

export const parseClarity = (
  raw: Record<string, RawPerk>,
): Map<number, ClarityLine[]> =>
  new Map(
    Object.entries(raw).flatMap(([hash, perk]) => {
      const lines = perk.descriptions?.en;

      return lines && lines.length > 0
        ? [[Number(hash), lines.map(parseLine)] as const]
        : [];
    }),
  );

const [perks, setPerks] = createSignal<Map<number, ClarityLine[]>>(new Map());

/** A perk's Clarity text, falling back to the base perk for an enhanced one */
export const clarityFor = (hash: number): ClarityLine[] | undefined => {
  const held = perks();
  const own = held.get(hash);

  if (own !== undefined) {
    return own;
  }

  const base = unenhancedVersion(hash);

  return base === undefined ? undefined : held.get(base);
};

/** Restores the cached Clarity text at idle, then refetches whenever Clarity publishes a new version */
export const startClarity = (): (() => void) => {
  let store: DefStore | undefined = undefined;
  let version: number | undefined = undefined;

  const sync = async () => {
    try {
      store ??= await openStore();

      if (version === undefined) {
        const saved = await store.getOne<StoredClarity>(CLARITY, STORED_KEY);

        if (saved !== undefined) {
          version = saved.version;
          setPerks(parseClarity(saved.raw));
        }
      }

      // GitHub Pages caches for 10 minutes
      const response = await fetch(VERSION_URL, { cache: "no-cache" });

      if (!response.ok) {
        return;
      }

      const live = ((await response.json()) as { descriptions: number })
        .descriptions;

      if (live === version) {
        return;
      }

      const descriptions = await fetch(DESCRIPTIONS_URL, { cache: "no-cache" });

      if (!descriptions.ok) {
        return;
      }

      const raw = (await descriptions.json()) as Record<string, RawPerk>;

      version = live;
      setPerks(parseClarity(raw));
      await store.putOne(CLARITY, STORED_KEY, { version: live, raw });
    } catch {
      // Offline or Pages is down
    }
  };

  const cancelIdle = onIdle(() => {
    void sync();
  });

  const timer = window.setInterval(() => {
    if (!document.hidden) {
      void sync();
    }
  }, HOUR);

  return () => {
    cancelIdle();
    window.clearInterval(timer);
  };
};
