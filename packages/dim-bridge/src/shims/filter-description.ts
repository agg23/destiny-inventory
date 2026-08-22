import type { FilterDescriptionInfo } from "app/search/filter-types";

import { Filter } from "../../../../vendor/DIM/src/locale/en.json";

// The real module renders a React fragment alongside this, and our i18next shim answers with the
// key it was handed, so filter help would read "Filter.Dupe". DIM's own catalogue is right here
const CATALOG: unknown = Filter;

const read = (key: string): string | undefined => {
  let node = CATALOG;

  for (const step of key.replace(/^Filter\./, "").split(".")) {
    if (typeof node !== "object" || node === null) {
      return undefined;
    }

    node = (node as Record<string, unknown>)[step];
  }

  return typeof node === "string" ? node : undefined;
};

// Catalogue entries reference each other as $t(Filter.Foo)
const lookup = (key: string): string | undefined =>
  read(key)?.replaceAll(
    /\$t\(([^)]+)\)/g,
    (whole, nested: string) => read(nested) ?? whole,
  );

const text = (description: FilterDescriptionInfo): string | undefined => {
  if (typeof description === "string") {
    return lookup(description);
  }

  if (Array.isArray(description)) {
    return lookup(description[0] as string);
  }

  const parts = Object.entries(description).flatMap(([keyword, key]) => {
    const resolved = lookup(
      Array.isArray(key) ? (key[0] as string) : (key as string),
    );

    return resolved === undefined ? [] : [`${keyword}: ${resolved}`];
  });

  return parts.length > 0 ? parts.join("\n") : undefined;
};

export const filterDescriptionText = text;
