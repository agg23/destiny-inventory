import { For, Show } from "solid-js";

import { Countdown } from "../../components/Countdown.tsx";
import { Heading } from "../../components/Heading.tsx";
import { Progress } from "../../components/lib/Progress.tsx";
import { CARD, HEADING_NOTE, SECTION } from "../../components/lib/text.ts";
import { readable } from "../../core/activities/activities.ts";
import type {
  Challenge,
  ChallengeGroup,
  Period,
} from "../../core/todo/challenges.ts";
import { nextDailyReset, nextWeeklyReset } from "../../core/todo/reset.ts";

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
    <Heading>
      {PERIODS[props.group.period]}
      <Countdown
        at={resetOf(props.group.period, props.now)}
        now={props.now}
        label="Resets"
        class={HEADING_NOTE}
      />
    </Heading>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3">
      <For each={props.group.challenges}>
        {(challenge) => (
          <ChallengeCard challenge={challenge} values={props.values} />
        )}
      </For>
    </div>
  </section>
);
