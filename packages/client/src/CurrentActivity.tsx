import { A } from "@solidjs/router";
import { createMemo, createResource, createSignal, Show } from "solid-js";

import {
  activityArt,
  baseName,
  categorize,
  tileArt,
} from "./activities.ts";
import { ActivityFacts } from "./Activities.tsx";
import { activityTables } from "./activityTables.ts";
import { useApp } from "./App.tsx";
import { guideNamed } from "./guides.ts";
import { guideHref } from "./url.ts";

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
        <div class="current-activity flex flex-col gap-2 px-3 pt-3">
          <h2 class="section-label m-0">Current activity</h2>
          <button
            type="button"
            class="plate current-activity-plate"
            style={{ "--art": tileArt(now().art, now().entry?.typeName) }}
            aria-expanded={open()}
            onClick={() => setOpen(!open())}
          >
            <span class="block truncate text-md text-fg">
              {now().guide.name}
            </span>
            <Show when={now().entry?.location}>
              {(location) => (
                <span class="block truncate text-sm text-muted">
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
            <A
              class="button small self-start"
              href={guideHref(now().guide.name)}
              state={{ inApp: true }}
            >
              Open guide
            </A>
          </Show>
        </div>
      )}
    </Show>
  );
};
