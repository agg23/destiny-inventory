import { A } from "@solidjs/router";
import { createMemo, createResource, Show, type JSX } from "solid-js";

import { categorize } from "../../core/activities/activities.ts";
import { baseName } from "../../core/activities/activityNames.ts";
import { activityTables } from "../../core/activities/activityTables.ts";
import { guideNamed } from "../../core/activities/guides.ts";
import { useApp } from "../../core/app/state.ts";
import { useClock } from "../../core/clock.ts";
import { duration } from "../../core/time.ts";
import { guideHref } from "../../core/url.ts";
import { ActivityFacts } from "../ActivityFacts.tsx";
import { cn } from "../lib/cn.ts";
import { Button } from "../lib/zaidan/button.tsx";
import { ChevronDown } from "../lib/zaidan/icons.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../lib/zaidan/popover.tsx";

const ROW = "flex h-10 w-full min-w-0 items-center gap-2 px-3 text-left";

export const CurrentActivity = (props: { loading: boolean }) => {
  const app = useApp();
  const clock = useClock();

  // Settled tables avoid a flash of the fallback on remount
  const [tables] = createResource(
    () => (app.playing() === undefined ? undefined : true),
    () => activityTables(),
    { initialValue: activityTables.settled() },
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

    if (!definition || !definition.name) {
      return undefined;
    }

    const guide = guideNamed(baseName(definition));
    const entry = !guide
      ? undefined
      : categorize(
          [...(activities?.availableActivities ?? [])],
          found,
          () => undefined,
        )
          .flatMap((realm) => realm.categories)
          .flatMap((category) => category.entries)
          .find((one) => one.name === guide.name);

    return {
      id,
      name: guide?.name ?? baseName(definition),
      guide,
      entry,
      startedAt: new Date(activities?.dateActivityStarted ?? 0).getTime(),
    };
  });

  const loading = () => props.loading || tables.loading;

  const spinner = () => (
    <span
      class={cn(
        "size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground",
        !loading() && "invisible",
      )}
      role="status"
      aria-label={loading() ? "Loading" : undefined}
    />
  );

  const dot = (online: boolean) => (
    <span
      class={cn(
        "size-2 shrink-0 rounded-full",
        online ? "bg-good" : "bg-muted-foreground/50",
      )}
      title={online ? "Online" : "Offline"}
      role="img"
      aria-label={online ? "Online" : "Offline"}
    />
  );

  const plain = (label: string, online: boolean): JSX.Element => (
    <div class={ROW}>
      {dot(online)}
      <span class="truncate font-medium">{label}</span>
      <span class="ml-auto" />
      {spinner()}
    </div>
  );

  return (
    <Show
      when={current()}
      fallback={
        app.playing() === undefined
          ? plain("Offline", false)
          : plain("Online", true)
      }
    >
      {(now) => {
        const contents = (
          <>
            {dot(true)}
            <span class="truncate font-medium">{now().name}</span>
            <Show when={now().entry?.location}>
              {(location) => (
                <span class="min-w-0 truncate text-xs text-muted-foreground">
                  {location()}
                </span>
              )}
            </Show>
            <span class="ml-auto" />
            {spinner()}
            <span class="text-xs text-muted-foreground tabular-nums">
              {duration((clock() - now().startedAt) / 1000)}
            </span>
          </>
        );

        return (
          <Show when={now().guide} fallback={<div class={ROW}>{contents}</div>}>
            <Popover placement="bottom" gutter={6}>
              <PopoverTrigger class={cn(ROW, "hover:bg-accent")}>
                {contents}
                <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent class="flex w-80 flex-col gap-3 p-3">
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
                  href={guideHref(now().name)}
                  state={{ inApp: true }}
                >
                  Open guide
                </Button>
              </PopoverContent>
            </Popover>
          </Show>
        );
      }}
    </Show>
  );
};
