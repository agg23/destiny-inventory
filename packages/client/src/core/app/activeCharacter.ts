import { createEffect, createSignal, on } from "solid-js";

import { NOBODY, observe, prefer, type Active } from "../profile/active.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import type { Url } from "../router.ts";

export const createActiveCharacter = (
  url: Url,
  current: () => LoadResult | undefined,
) => {
  const character = () => url.get("character");
  const [active, setActive] = createSignal<Active>(
    character() === undefined ? NOBODY : prefer(NOBODY, character() ?? ""),
  );

  createEffect(
    on(
      () => current()?.playing,
      (playing) => {
        const was = active();
        const next = observe(was, playing);
        setActive(next);

        if (was.override !== undefined && next.override === undefined) {
          url.replace({ character: undefined });
        }
      },
    ),
  );

  createEffect(
    on(
      character,
      (id) =>
        setActive((was) =>
          id === undefined ? { ...was, override: undefined } : prefer(was, id),
        ),
      { defer: true },
    ),
  );

  return { active, setActive };
};
