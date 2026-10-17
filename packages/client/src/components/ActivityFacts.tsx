import { For, Show } from "solid-js";

import { barred, readable } from "../core/activities/activities.ts";
import {
  doors,
  ladder,
  TOP_GEAR_TIER,
  type Values,
} from "../core/activities/activityFormat.ts";
import type { Available, Challenge } from "../core/activities/types.ts";
import { Objective } from "./lib/Progress.tsx";
import { LABEL, SPENT } from "./lib/text.ts";

export const Challenges = (props: { challenges: Challenge[] }) => (
  <ul class="flex flex-col gap-1.5">
    <For each={props.challenges}>
      {(one) => (
        <li class="min-w-0" classList={{ [SPENT]: one.complete }}>
          <Show
            when={one.goal > 1}
            fallback={<span class="text-muted-foreground">{one.name}</span>}
          >
            <Objective
              label={one.name}
              progress={one.progress}
              goal={one.goal}
            />
          </Show>
        </li>
      )}
    </For>
  </ul>
);

export const ActivityFacts = (props: {
  entry: Available;
  values: Values;
  power: number | undefined;
}) => (
  <div class="flex flex-col gap-4 overflow-hidden">
    <Show when={props.entry.description}>
      <p class="text-muted-foreground">{props.entry.description}</p>
    </Show>
    <Show when={props.entry.locked.length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Locked</p>
        <ul class="flex flex-col gap-1 text-destructive">
          <For each={props.entry.locked}>
            {(one) => <li>{readable(one, props.values)}</li>}
          </For>
        </ul>
      </div>
    </Show>
    <Show when={props.entry.challenges.length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Challenges</p>
        <Challenges challenges={props.entry.challenges} />
      </div>
    </Show>
    <Show when={ladder(props.entry).length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Difficulty</p>
        <p>
          <For each={ladder(props.entry)}>
            {(one, index) => (
              <>
                <Show when={index() > 0}>
                  <span class="text-muted-foreground"> · </span>
                </Show>
                <span
                  classList={{
                    "text-muted-foreground/60":
                      one.tier !== undefined && barred(one.tier, props.power),
                  }}
                  title={
                    one.tier && barred(one.tier, props.power)
                      ? `${one.tier.power} power to launch`
                      : undefined
                  }
                >
                  {one.name}
                </span>
              </>
            )}
          </For>
        </p>
      </div>
    </Show>
    <Show when={doors(props.entry).length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Gear tier</p>
        <ul class="flex flex-col gap-1">
          <For each={doors(props.entry)}>
            {(door) => (
              <li class="flex items-baseline justify-between gap-4">
                <Show when={door.name}>
                  {(name) => (
                    <span class="text-muted-foreground">{name()}</span>
                  )}
                </Show>
                <span
                  classList={{ "text-cream": door.tier.low >= TOP_GEAR_TIER }}
                >
                  Tier{" "}
                  {door.tier.low === door.tier.high
                    ? door.tier.high
                    : `${door.tier.low}-${door.tier.high}`}
                </span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
    <Show when={props.entry.modifiers.length > 0}>
      <div class="flex flex-col gap-1.5">
        <p class={LABEL}>Modifiers</p>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <For each={props.entry.modifiers}>
            {(one) => (
              <li class="min-w-0 text-xs">
                <div class="text-foreground">{one.name}</div>
                <Show when={one.description}>
                  <div class="text-muted-foreground">
                    {readable(one.description, props.values)}
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  </div>
);
