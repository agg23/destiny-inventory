import { useSearchParams } from "@solidjs/router";

import { readParam, writeParams, type ParamKey, type Params } from "./url.ts";

let typed = false;

const forget = () => {
  typed = false;
};

globalThis.addEventListener("popstate", forget);

export interface Url {
  get: <K extends ParamKey>(key: K) => Params[K];
  push: (patch: Partial<Params>) => void;
  replace: (patch: Partial<Params>) => void;
  type: (patch: Partial<Params>) => void;
}

export const useUrl = (): Url => {
  const [search, setSearch] = useSearchParams();

  const set = (patch: Partial<Params>, replace: boolean) =>
    setSearch(writeParams(patch), { replace, scroll: false });

  return {
    get: (key) => readParam(key, search[key] as string | undefined),

    push: (patch) => {
      forget();
      set(patch, false);
    },

    replace: (patch) => {
      forget();
      set(patch, true);
    },

    type: (patch) => {
      set(patch, typed);
      typed = true;
    },
  };
};
