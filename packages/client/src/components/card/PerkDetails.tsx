import type { DimItem } from "app/inventory/item-types";
import type { DestinyObjectiveProgress } from "bungie-api-ts/destiny2";
import { createMemo, For, Show } from "solid-js";

import { BUNGIE } from "../../core/api/bungie.ts";
import type { Catalyst } from "../../core/collections/types.ts";
import {
  archetype,
  benefits,
  catalysts,
  intrinsics,
  setBonus,
  type CatalystState,
} from "../../core/items/perks.ts";
import {
  MODE_NAMES,
  setBonusFor,
  setBonusesRanked,
} from "../../core/items/rolls.ts";
import { defs } from "../../core/profile/defs.ts";
import { shownModes } from "../../core/settings.ts";
import { Objective } from "../lib/Progress.tsx";
import { LABEL, sentence } from "../lib/text.ts";
import { Badge } from "../lib/zaidan/badge.tsx";
import { RollTier } from "./AegisNote.tsx";
import { Changes } from "./Stats.tsx";

const perkIconClass = (enhanced?: boolean, square?: boolean): string =>
  square
    ? "size-8 flex-none"
    : `size-8 flex-none rounded-full border bg-foreground/8 ${
        enhanced ? "border-light" : "border-foreground/50"
      }`;

export const PerkIcon = (props: {
  icon: string | undefined;
  enhanced?: boolean;
  square?: boolean;
}) => (
  <Show
    when={props.icon}
    fallback={<span class={perkIconClass(props.enhanced, props.square)} />}
  >
    {(icon) => (
      <img
        class={perkIconClass(props.enhanced, props.square)}
        src={`${BUNGIE}${icon()}`}
        alt=""
        loading="lazy"
      />
    )}
  </Show>
);

/** An icon beside a perk's name and description */
export const PERK = "flex items-start gap-3 py-1.5";

export const PERK_NAME = "block font-medium text-foreground";

/** A perk name followed by badges */
export const PERK_TITLE =
  "flex flex-wrap items-center gap-1.5 font-medium text-foreground";

export const PERK_TEXT = "block text-xs whitespace-pre-wrap text-muted-foreground";

/** Light gold, for Enhanced and other game-marked states */
export const GOLD_BADGE = "border-light/40 text-light";

export const Archetype = (props: { item: DimItem }) => {
  const found = createMemo(() => archetype(props.item));

  return (
    <Show when={found()}>
      {(plug) => (
        <div class={`${PERK} items-center!`} title={plug().description}>
          <PerkIcon icon={plug().icon} />
          <b class={PERK_NAME}>{plug().name}</b>
        </div>
      )}
    </Show>
  );
};

export const Intrinsics = (props: { item: DimItem }) => {
  const list = createMemo(() => intrinsics(props.item));

  return (
    <For each={list()}>
      {(intrinsic) => (
        <div class={PERK}>
          <PerkIcon icon={intrinsic.icon} square />
          <div class="min-w-0">
            <b class={PERK_NAME}>{intrinsic.name}</b>
            <Changes stats={intrinsic.stats} />
            <Show when={intrinsic.description}>
              <span class={PERK_TEXT}>
                {intrinsic.description}
              </span>
            </Show>
          </div>
        </div>
      )}
    </For>
  );
};

const STATE_LABELS: Record<CatalystState, string> = {
  missing: "Missing",
  obtained: "Obtained",
  complete: "Complete",
};

const Objectives = (props: { objectives: DestinyObjectiveProgress[] }) => (
  <ul class="mt-1.5 flex max-w-105 flex-col gap-1.5 text-xs">
    <For each={props.objectives}>
      {(objective) => (
        <li>
          <Objective
            label={
              defs()?.Objective.getOptional(objective.objectiveHash)
                ?.progressDescription ?? ""
            }
            progress={objective.progress ?? 0}
            goal={objective.completionValue}
          />
        </li>
      )}
    </For>
  </ul>
);

export const Catalysts = (props: { item: DimItem; account?: Catalyst }) => {
  const list = createMemo(() => catalysts(props.item, props.account));

  return (
    <Show when={list().length > 0}>
      <div>
        <h4 class={`${LABEL} mt-3 mb-1.5`}>
          {list().length > 1 ? "Catalysts" : "Catalyst"}
        </h4>
        <For each={list()}>
          {(catalyst) => (
            <div class={PERK}>
              <PerkIcon icon={catalyst.icon} square />
              <div class="min-w-0">
                <b class={PERK_TITLE}>
                  {catalyst.name}
                  <Show when={catalyst.state}>
                    {(state) => (
                      <Badge
                        variant="outline"
                        class={
                          state() === "missing"
                            ? "text-muted-foreground"
                            : GOLD_BADGE
                        }
                      >
                        {STATE_LABELS[state()]}
                      </Badge>
                    )}
                  </Show>
                  <Show when={catalyst.inserted}>
                    <Badge variant="outline" class={GOLD_BADGE}>
                      Inserted
                    </Badge>
                  </Show>
                </b>
                <Changes stats={catalyst.stats} />
                <For each={catalyst.lines}>
                  {(line) => (
                    <span class={PERK_TEXT}>
                      <Show when={line.name}>
                        {(name) => <span class="text-light">{name()}: </span>}
                      </Show>
                      {line.description}
                    </span>
                  )}
                </For>
                <Show
                  when={
                    catalyst.state === "obtained" &&
                    catalyst.objectives.length > 0
                  }
                >
                  <Objectives objectives={catalyst.objectives} />
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

export const Masterwork = (props: { item: DimItem }) => {
  const primary = () =>
    (props.item.masterworkInfo?.stats ?? []).filter(
      (stat) => stat.isPrimary && stat.name && stat.value > 0,
    );

  const tier = () => props.item.masterworkInfo?.tier;

  // Unmasterworked armor still carries a masterworkInfo at tier 0
  const worth = () =>
    props.item.masterwork || !!tier() || primary().length > 0;

  return (
    <Show when={worth()}>
      <p
        class="m-0 text-xs"
        classList={{
          "text-light": props.item.masterwork,
          "text-muted-foreground": !props.item.masterwork,
        }}
      >
        <b class="font-medium">Masterwork</b>
        <Show when={tier()}>{(level) => <> {level()}</>}</Show>
        <For each={primary()}>
          {(stat) => (
            <>
              {" "}
              · {stat.name} +{stat.value}
            </>
          )}
        </For>
      </p>
    </Show>
  );
};

// Set effects live on the sandbox perks
export const SetBonus = (props: { item: DimItem }) => {
  const bonus = createMemo(() => setBonus(props.item));

  return (
    <Show when={bonus()}>
      {(set) => (
        <>
          <h4 class={`${LABEL} mt-3 mb-1.5`}>{set().name}</h4>
          <For each={set().perks}>
            {(perk) => {
              const rated = () =>
                shownModes().flatMap((mode) => {
                  const rating = setBonusFor(perk.hash, mode);

                  return rating ? [{ mode, rating }] : [];
                });

              return (
                <div class={PERK}>
                  <PerkIcon icon={perk.icon} />
                  <div class="min-w-0">
                    <b class={PERK_NAME}>
                      {perk.requiredSetCount} piece · {perk.name}
                    </b>
                    <span class={PERK_TEXT}>{perk.description}</span>
                    <Show when={rated().length > 0}>
                      <div class="mt-1.5 flex flex-col gap-1.5 border-t pt-1.5 text-xs">
                        <For each={rated()}>
                          {(entry) => (
                            <div>
                              <span class="flex items-baseline gap-2">
                                <Show when={entry.rating.tier}>
                                  {(tier) => <RollTier tier={tier()} />}
                                </Show>
                                <span class="text-muted-foreground">
                                  {MODE_NAMES[entry.mode]}
                                </span>
                                <Show when={entry.rating.rank}>
                                  {(rank) => (
                                    <span class="text-muted-foreground">
                                      #{rank()} of{" "}
                                      {setBonusesRanked(entry.mode)}
                                    </span>
                                  )}
                                </Show>
                              </span>
                              <Show when={entry.rating.notes}>
                                {(notes) => (
                                  <span class="block text-muted-foreground">
                                    {sentence(notes())}
                                  </span>
                                )}
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </>
      )}
    </Show>
  );
};

export const Benefits = (props: { item: DimItem }) => {
  const list = createMemo(() => benefits(props.item));

  return (
    <Show when={list().length > 0}>
      <For each={list()}>
        {(benefit) => (
          <div class={PERK}>
            <PerkIcon
              icon={benefit.icon}
              enhanced={benefit.enhanced}
              square={benefit.intrinsic}
            />
            <div class="min-w-0">
              <b
                class={PERK_TITLE}
                classList={{ "text-light!": benefit.enhanced }}
              >
                {benefit.name}
                <Show when={benefit.enhanced}>
                  <Badge variant="outline" class={GOLD_BADGE}>
                    Enhanced
                  </Badge>
                </Show>
                <Show when={benefit.intrinsic}>
                  <Badge variant="outline" class={GOLD_BADGE}>
                    Intrinsic
                  </Badge>
                </Show>
              </b>
              <Changes stats={benefit.stats} />
              <Show when={benefit.description}>
                <span class={PERK_TEXT}>
                  {benefit.description}
                </span>
              </Show>
            </div>
          </div>
        )}
      </For>
    </Show>
  );
};
