import { For, Show } from "solid-js";

import { readable } from "../activities.ts";
import type { Challenge, ChallengeGroup, Period } from "../challenges.ts";
import { nextDailyReset, nextWeeklyReset, remaining } from "../reset.ts";
import { exact } from "./todoFormat.ts";

const PERIODS: Record<Period, string> = {
  daily: "Daily challenges",
  weekly: "Weekly challenges",
};

const resetOf = (period: Period, now: number): number =>
  period === "daily" ? nextDailyReset(now) : nextWeeklyReset(now);

const percent = (progress: number, goal: number): number =>
  goal === 0 ? 0 : Math.min(100, (progress / goal) * 100);

const ChallengeCard = (props: {
  challenge: Challenge;
  values: Record<number, number>;
}) => (
  <div class="challenge-card" classList={{ claimed: props.challenge.redeemed }}>
    <div class="order-head">
      <span class="order-name">{props.challenge.name}</span>
      <Show
        when={props.challenge.complete}
        fallback={
          <span class="whitespace-nowrap tabular-nums">
            {props.challenge.progress.toLocaleString()} /{" "}
            {props.challenge.goal.toLocaleString()}
          </span>
        }
      >
        <span class="text-success whitespace-nowrap">
          {props.challenge.redeemed ? "Claimed" : "Complete"}
        </span>
      </Show>
    </div>
    <p
      class="order-note clamped m-0 text-muted"
      title={readable(props.challenge.description, props.values)}
    >
      {readable(props.challenge.description, props.values)}
    </p>
    <div class="progress objective">
      <span
        class="progress-fill"
        style={{
          width: `${percent(props.challenge.progress, props.challenge.goal)}%`,
        }}
      />
    </div>
  </div>
);

export const Challenges = (props: {
  group: ChallengeGroup;
  now: number;
  values: Record<number, number>;
}) => (
  <section class="todo-section">
    <h2 class="section-label">
      {PERIODS[props.group.period]}
      <span
        class="section-note whitespace-nowrap tabular-nums"
        title={`Resets ${exact(resetOf(props.group.period, props.now))}`}
      >
        {remaining(resetOf(props.group.period, props.now) - props.now)} left
      </span>
    </h2>
    <div class="challenge-grid">
      <For each={props.group.challenges}>
        {(challenge) => (
          <ChallengeCard challenge={challenge} values={props.values} />
        )}
      </For>
    </div>
  </section>
);
