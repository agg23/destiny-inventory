import { createEffect, createSignal, on } from "solid-js";

import type { Url } from "../router.ts";

export const createQuery = (url: Url) => {
  const [typed, setTyped] = createSignal(url.get("q"));
  const [previewQuery, setPreviewQuery] = createSignal<string | undefined>(
    undefined,
  );

  const onQuery = (value: string) => {
    setTyped(value);
    url.type({ q: value });
  };

  createEffect(
    on(
      () => url.get("q"),
      (fromUrl) => setTyped(fromUrl),
      { defer: true },
    ),
  );

  return { typed, onQuery, previewQuery, setPreviewQuery };
};
