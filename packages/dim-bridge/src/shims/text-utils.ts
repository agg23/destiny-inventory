import type { DimLanguage } from "app/i18n";

import { plainString as normalize } from "../../../../vendor/DIM/src/app/search/text-utils.ts";

export * from "../../../../vendor/DIM/src/app/search/text-utils.ts";

// NFD normalization is the bulk of search time per keystroke
const normalized = new Map<string, Map<string, string>>();

let recording: string[] | undefined = undefined;

/** Collects every string DIM's filters normalize during run */
export const recordStrings = (run: () => void): string[] => {
  const held = recording;

  recording = [];

  try {
    run();

    return recording;
  } finally {
    recording = held;
  }
};

export const plainString = (text: string, language: DimLanguage): string => {
  let cache = normalized.get(language);

  if (cache === undefined) {
    cache = new Map();
    normalized.set(language, cache);
  }

  let hit = cache.get(text);

  if (hit === undefined) {
    hit = normalize(text, language);
    cache.set(text, hit);
  }

  recording?.push(hit);

  return hit;
};
