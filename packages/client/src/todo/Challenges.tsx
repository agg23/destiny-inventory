import { For, Show } from "solid-js";

import { readable } from "../activities.ts";
import type { Challenge, ChallengeGroup, Period } from "../challenges.ts";
import { nextDailyReset, nextWeeklyReset, remaining } from "../reset.ts";
import { Progress } from "../ui/Progress.tsx";
import { CARD, HEADING, HEADING_NOTE, SECTION } from "../ui/text.ts";
import { exact } from "./todoFormat.ts";

const PERIODS: Record<Period, string> = {
  daily: "Daily challenges",
  weekly: "Weekly challenges",
};

const resetOf = (period: Period, now: number): number =>
  period === "daily" ? nextDailyReset(now) : nextWeeklyReset(now);

const ChallengeCard = (props: {
  challenge: Challenge;
  values: Record<number, number>;
}) => (
  <div class={CARD} classList={{ "opacity-55": props.challenge.redeemed }}>
    <div class="flex items-center gap-2">
      <span class="min-w-0 flex-1 font-medium">{props.challenge.name}</span>
      <Show
        when={props.challenge.complete}
        fallback={
          <span class="whitespace-nowrap tabular-nums">
            {props.challenge.progress.toLocaleString()} /{" "}
            {props.challenge.goal.toLocaleString()}
          </span>
        }
      >
        <span class="whitespace-nowrap text-good">
          {props.challenge.redeemed ? "Claimed" : "Complete"}
        </span>
      </Show>
    </div>
    {/* Reserves two lines to keep the bars aligned */}
    <p
      class="line-clamp-2 min-h-[2lh] text-xs text-muted-foreground"
      title={readable(props.challenge.description, props.values)}
    >
      {readable(props.challenge.description, props.values)}
    </p>
    <Progress
      value={props.challenge.progress / Math.max(1, props.challenge.goal)}
    />
  </div>
);

export const Challenges = (props: {
  group: ChallengeGroup;
  now: number;
  values: Record<number, number>;
}) => (
  <section class={SECTION}>
    <h2 class={`${HEADING} flex items-baseline gap-2`}>
      {PERIODS[props.group.period]}
      <span
        class={HEADING_NOTE}
        title={`Resets ${exact(resetOf(props.group.period, props.now))}`}
      >
        {remaining(resetOf(props.group.period, props.now) - props.now)} left
      </span>
    </h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3">
      <For each={props.group.challenges}>
        {(challenge) => (
          <ChallengeCard challenge={challenge} values={props.values} />
        )}
      </For>
    </div>
  </section>
);
