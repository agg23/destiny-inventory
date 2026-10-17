import { canonicalFilterFormats } from "app/search/filter-types";
import type { ItemSearchConfig } from "app/search/items/item-filter-types";
import { plainString } from "app/search/text-utils";

/** Completions ranked before the list is cut, enough to fill the menu */
export const ROWS = 16;

const MATH_TAIL = /[\d<>=]$/;

const COMPARISON_TAIL = /[<>]=?$/;

interface Ranked {
  rawText: string;
  plainText: string;
  colons: number;
  segmentStart: number;
  tagged: boolean;
  negated: boolean;
  demoted: boolean;
  isOrNot: boolean;
  trailingColon: boolean;
  math: boolean;
  comparison: boolean;
  bucket: number;
}

interface Match {
  word: Ranked;
  at: number;
}

const colonCount = (text: string): number => {
  let count = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === ":") {
      count += 1;
    }
  }

  return count;
};

const rank = (rawText: string, plainText: string): Ranked => {
  const colons = colonCount(plainText);
  const negated = plainText.startsWith("not:");

  return {
    rawText,
    plainText,
    colons,
    segmentStart: plainText.indexOf(":") + 1,
    tagged: plainText.startsWith("tag:"),
    negated,
    demoted: negated || plainText.includes(":<=") || plainText.includes(":>="),
    isOrNot: negated || plainText.startsWith("is:"),
    trailingColon: plainText.endsWith(":"),
    math: MATH_TAIL.test(plainText),
    comparison: COMPARISON_TAIL.test(plainText),
    bucket: plainText.startsWith("is:") ? 0 : colons,
  };
};

const before = (one: Match, other: Match, typedLength: number): number => {
  const first =
    one.word.colons > 1
      ? 1
      : one.at === 0 || one.at === one.word.segmentStart
        ? -1
        : 0;
  const second =
    other.word.colons > 1
      ? 1
      : other.at === 0 || other.at === other.word.segmentStart
        ? -1
        : 0;

  if (first !== second) {
    return first - second;
  }

  if (one.word.tagged !== other.word.tagged) {
    return one.word.tagged ? -1 : 1;
  }

  if (one.word.demoted !== other.word.demoted) {
    return one.word.demoted ? 1 : -1;
  }

  if (one.word.bucket !== other.word.bucket) {
    return one.word.bucket - other.word.bucket;
  }

  const left = one.word.isOrNot
    ? one.word.plainText.length - (typedLength + one.at)
    : 0;
  const right = other.word.isOrNot
    ? other.word.plainText.length - (typedLength + other.at)
    : 0;

  if (left !== right) {
    return left - right;
  }

  if (one.word.trailingColon !== other.word.trailingColon) {
    return one.word.trailingColon ? -1 : 1;
  }

  if (one.word.math !== other.word.math) {
    return one.word.math ? -1 : 1;
  }

  return 0;
};

/** DIM's filter completion, ranked identically but stopping once the visible rows are filled */
export const makeComplete = (
  config: ItemSearchConfig,
): ((typed: string) => string[]) => {
  const freeformTerms: string[] = [];
  const multiqueryTerms: Record<string, string[]> = {};

  for (const filter of Object.values(config.filtersMap.kvFilters)) {
    const formats = canonicalFilterFormats(filter.format);
    const keywords = Array.isArray(filter.keywords)
      ? filter.keywords
      : [filter.keywords];

    if (formats.includes("freeform")) {
      for (const keyword of keywords) {
        freeformTerms.push(`${keyword}:`);
      }
    }

    if (formats.includes("multiquery")) {
      for (const keyword of keywords) {
        (multiqueryTerms[keyword] ??= []).push(...(filter.suggestions ?? []));
      }
    }
  }

  const ranked = config.suggestions.map((suggestion) =>
    rank(suggestion.rawText, suggestion.plainText),
  );

  return (typed: string): string[] => {
    if (!typed) {
      return [];
    }

    const typedToLower = typed.toLowerCase();
    let typedPlain = plainString(typedToLower, config.language);
    const typedSegments = typedPlain.split(":");
    const possibleKeyword = typedSegments[0]!;

    const hasNotModifier = typedPlain.startsWith("not");
    const includesAdvancedMath =
      typedPlain.endsWith(":") || typedPlain.endsWith("<");

    let mustStartWith = "";

    if (freeformTerms.some((term) => typedPlain.startsWith(term))) {
      mustStartWith = typedSegments.shift()!;
      typedPlain = typedSegments.join(":");
    }

    const startsOnly = !mustStartWith && typedPlain.includes(":");
    const typedLength = typedPlain.length;
    const best: Match[] = [];
    const taken = new Set<string>();

    const place = (match: Match) => {
      if (taken.has(match.word.rawText)) {
        return;
      }

      let index = best.length;

      while (index > 0 && before(match, best[index - 1]!, typedLength) < 0) {
        index -= 1;
      }

      if (index >= ROWS) {
        return;
      }

      best.splice(index, 0, match);
      taken.add(match.word.rawText);

      if (best.length > ROWS) {
        taken.delete(best.pop()!.word.rawText);
      }
    };

    for (const word of ranked) {
      if (!word.plainText.startsWith(mustStartWith)) {
        continue;
      }

      const at = word.plainText.indexOf(typedPlain);

      if (at < 0 || (startsOnly && at !== 0)) {
        continue;
      }

      if (word.negated && !hasNotModifier) {
        continue;
      }

      if (word.comparison && !includesAdvancedMath) {
        continue;
      }

      if (
        word.rawText === typed ||
        word.rawText === typedToLower ||
        word.rawText === typedPlain
      ) {
        continue;
      }

      place({ word, at });
    }

    const multiquery = multiqueryTerms[possibleKeyword];

    // DIM gates this on a name list too, but dupe is its only multiquery filter and is on it
    if (multiquery) {
      const existing = new Set(
        (typedSegments[1] || "")
          .split("+")
          .filter((term) => multiquery.includes(term)),
      );
      const joined = [...existing].join("+");
      const stem = `${typedSegments[0]}:${joined}${existing.size ? "+" : ""}`;

      for (const term of multiquery) {
        if (existing.has(term)) {
          continue;
        }

        const text = stem + term;

        if (text === typed || text === typedToLower || text === typedPlain) {
          continue;
        }

        place({ word: rank(text, text), at: text.indexOf(typedPlain) });
      }
    }

    return best.map((match) => match.word.rawText);
  };
};
