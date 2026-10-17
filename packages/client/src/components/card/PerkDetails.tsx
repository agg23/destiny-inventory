import type { DimItem } from "app/inventory/item-types";
import type { DestinyObjectiveProgress } from "bungie-api-ts/destiny2";
import { createMemo, For, Show } from "solid-js";

import { CATALYST_LABELS } from "../../core/collections/labels.ts";
import type { Catalyst } from "../../core/collections/types.ts";
import {
  archetype,
  benefits,
  catalysts,
  intrinsics,
  setBonus,
} from "../../core/items/perks.ts";
import { setBonusFor, setBonusesRanked } from "../../core/items/rolls.ts";
import { MODE_NAMES } from "../../core/items/rollTypes.ts";
import { defs } from "../../core/profile/defs.ts";
import { shownModes } from "../../core/settings.ts";
import { sentence } from "../../core/text.ts";
import { Objective } from "../lib/Progress.tsx";
import { LABEL } from "../lib/text.ts";
import { Badge } from "../lib/zaidan/badge.tsx";
import { RollTier } from "./AegisNote.tsx";
import { GOLD_BADGE, GoldBadge } from "./GoldBadge.tsx";
import { PERK, PERK_NAME, PERK_TEXT, PerkIcon, PerkRow } from "./PerkRow.tsx";

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
        <PerkRow
          icon={intrinsic.icon}
          square
          name={intrinsic.name}
          stats={intrinsic.stats}
          description={intrinsic.description}
        />
      )}
    </For>
  );
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
            <PerkRow
              icon={catalyst.icon}
              square
              badged
              name={
                <>
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
                        {CATALYST_LABELS[state()]}
                      </Badge>
                    )}
                  </Show>
                  <Show when={catalyst.inserted}>
                    <GoldBadge>Inserted</GoldBadge>
                  </Show>
                </>
              }
              stats={catalyst.stats}
            >
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
            </PerkRow>
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
                <PerkRow
                  icon={perk.icon}
                  name={
                    <>
                      {perk.requiredSetCount} piece · {perk.name}
                    </>
                  }
                >
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
                </PerkRow>
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
          <PerkRow
            icon={benefit.icon}
            enhanced={benefit.enhanced}
            square={benefit.intrinsic}
            badged
            name={
              <>
                {benefit.name}
                <Show when={benefit.enhanced}>
                  <GoldBadge>Enhanced</GoldBadge>
                </Show>
                <Show when={benefit.intrinsic}>
                  <GoldBadge>Intrinsic</GoldBadge>
                </Show>
              </>
            }
            stats={benefit.stats}
            description={benefit.description}
          />
        )}
      </For>
    </Show>
  );
};
