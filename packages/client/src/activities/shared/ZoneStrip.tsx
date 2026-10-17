import { For, Show } from "solid-js";

import { AnchoredPanel } from "../../components/lib/AnchoredPanel.tsx";
import { readable } from "../../core/activities/activities.ts";
import type { Values } from "../../core/activities/activityFormat.ts";
import { createHoverCard } from "../../core/items/preview.ts";
import { defs } from "../../core/profile/defs.ts";
import { HOUR, shortTime } from "../../core/time.ts";
import type { Data } from "./activityData.ts";
import { countdown, type Rotation } from "./distortion.ts";
import { PANEL } from "./RunDetail.tsx";

// Now plus the next three
const STRIP_ZONES = 4;

export const Bonus = (props: { pieces: number; perk: number; values: Values }) => (
  <Show when={defs()?.SandboxPerk.getOptional(props.perk)}>
    {(perk) => (
      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-2">
          <span class="font-medium text-foreground">
            {perk().displayProperties.name}
          </span>
          <span class="text-xs text-muted-foreground">
            {props.pieces} pc
          </span>
        </div>
        <div class="whitespace-pre-line text-muted-foreground">
          {readable(perk().displayProperties.description, props.values)}
        </div>
      </div>
    )}
  </Show>
);

const SetBonuses = (props: { turn: Rotation; values: Values }) => (
  <Show when={defs()?.EquipableItemSet.getOptional(props.turn.set)}>
    {(set) => (
      <>
        <p class="text-muted-foreground">{set().displayProperties.name}</p>
        <For each={set().setPerks}>
          {(perk) => (
            <Bonus
              pieces={perk.requiredSetCount}
              perk={perk.sandboxPerkHash}
              values={props.values}
            />
          )}
        </For>
      </>
    )}
  </Show>
);

const zoneTime = (turn: Rotation, active: boolean, now: number): string =>
  active
    ? `Now · ${countdown(turn.start + HOUR - now)} left`
    : shortTime(turn.start);

export const ZoneStrip = (props: { data: Data }) => {
  const card = createHoverCard<Rotation>({});

  return (
    <div class="flex h-10 items-center gap-1 rounded-lg border px-2">
      <span class="px-1 text-muted-foreground">Distortion</span>
      <For each={props.data.turns().slice(0, STRIP_ZONES)}>
        {(turn, index) => (
          <span
            class="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-muted"
            onMouseEnter={(event) => card.open(turn, event.currentTarget)}
            onMouseLeave={card.clear}
          >
            <span
              classList={{
                "font-medium text-foreground": index() === 0,
                "text-muted-foreground": index() !== 0,
              }}
            >
              {turn.name}
            </span>
            <span
              class="tabular-nums"
              classList={{
                "text-light": index() === 0,
                "text-muted-foreground": index() !== 0,
              }}
            >
              {zoneTime(turn, index() === 0, props.data.now())}
            </span>
          </span>
        )}
      </For>
      <Show when={card.shown()}>
        {(turn) => (
          <AnchoredPanel class={PANEL}>
            <span class="text-base font-medium text-foreground">
              {turn().name}
            </span>
            <SetBonuses turn={turn()} values={props.data.values()} />
          </AnchoredPanel>
        )}
      </Show>
    </div>
  );
};
