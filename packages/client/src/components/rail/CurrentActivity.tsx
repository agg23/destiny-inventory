import { A } from "@solidjs/router";
import { createMemo, createResource, createSignal, Show } from "solid-js";

import { categorize } from "../../core/activities/activities.ts";
import { baseName } from "../../core/activities/activityNames.ts";
import { activityTables } from "../../core/activities/activityTables.ts";
import { activityArt, tileArt } from "../../core/activities/art.ts";
import { guideNamed } from "../../core/activities/guides.ts";
import { useApp } from "../../core/app/state.ts";
import { guideHref } from "../../core/url.ts";
import { ActivityFacts } from "../ActivityFacts.tsx";
import { HEADING } from "../lib/text.ts";
import { Button } from "../lib/zaidan/button.tsx";

export const CurrentActivity = () => {
  const app = useApp();
  const [open, setOpen] = createSignal(false);

  const [tables] = createResource(
    () => (app.playing() === undefined ? undefined : true),
    () => activityTables(),
  );

  const current = createMemo(() => {
    const id = app.playing();
    const loaded = app.loaded();
    const found = tables();

    if (id === undefined || !loaded || !found) {
      return undefined;
    }

    const activities = loaded.activities[id];
    const hash = activities?.currentActivityHash ?? 0;
    const definition = found.activities[hash];

    if (!definition) {
      return undefined;
    }

    const guide = guideNamed(baseName(definition));

    if (!guide) {
      return undefined;
    }

    const entry = categorize(
      [...(activities?.availableActivities ?? [])],
      found,
      () => undefined,
    )
      .flatMap((realm) => realm.categories)
      .flatMap((category) => category.entries)
      .find((one) => one.name === guide.name);

    return {
      id,
      guide,
      entry,
      art: activityArt(definition, found),
    };
  });

  return (
    <Show when={current()}>
      {(now) => (
        <div class="flex flex-col gap-2 px-4 pt-4">
          <h2 class={HEADING}>Current activity</h2>
          <button
            type="button"
            class="flex h-16 flex-col justify-end overflow-hidden rounded-lg bg-cover bg-center px-3 py-2 text-left ring-1 ring-foreground/10 hover:ring-foreground/40 aria-expanded:ring-foreground/40"
            style={{
              "background-image": `linear-gradient(to top, rgb(0 0 0 / 80%), rgb(0 0 0 / 20%)), ${tileArt(now().art, now().entry?.typeName)}`,
            }}
            aria-expanded={open()}
            onClick={() => setOpen(!open())}
          >
            <span class="block truncate font-medium text-shadow-art">
              {now().guide.name}
            </span>
            <Show when={now().entry?.location}>
              {(location) => (
                <span class="block truncate text-xs text-foreground/70 text-shadow-art">
                  {location()}
                </span>
              )}
            </Show>
          </button>
          <Show when={open()}>
            <Show when={now().entry}>
              {(entry) => (
                <ActivityFacts
                  entry={entry()}
                  values={app.loaded()?.variables[now().id] ?? {}}
                  power={
                    app.stores().find((store) => store.id === now().id)
                      ?.powerLevel
                  }
                />
              )}
            </Show>
            <Button
              as={A}
              variant="outline"
              size="sm"
              class="self-start"
              href={guideHref(now().guide.name)}
              state={{ inApp: true }}
            >
              Open guide
            </Button>
          </Show>
        </div>
      )}
    </Show>
  );
};
