import { BreakerTypeHashes } from "data/d2/generated-enums";
import classHunter from "destiny-icons/general/class_hunter.svg?inline";
import classTitan from "destiny-icons/general/class_titan.svg?inline";
import classWarlock from "destiny-icons/general/class_warlock.svg?inline";
import { For, Show, type JSX } from "solid-js";

import type {
  ClarityIcon,
  ClarityLine,
  ClaritySpan,
  ClarityTone,
} from "../../core/items/clarity.ts";
import { defs } from "../../core/profile/defs.ts";
import { BungieImage } from "../BungieImage.tsx";
import { AMMO } from "./ItemHead.tsx";
import { PERK_TEXT } from "./PerkRow.tsx";

// DestinyDamageTypeDefinition
const DAMAGE_TYPES: Partial<Record<ClarityIcon, number>> = {
  kinetic: 3373582085,
  arc: 2303181850,
  solar: 1847026933,
  void: 3454344768,
  stasis: 151347233,
  strand: 3949783978,
};

const BREAKERS: Partial<Record<ClarityIcon, number>> = {
  barrier: BreakerTypeHashes.ShieldPiercing,
  overload: BreakerTypeHashes.Disruption,
  unstoppable: BreakerTypeHashes.Stagger,
};

// The class svgs are black
const MASKED: Partial<Record<ClarityIcon, string>> = {
  primary: AMMO[1]!.url,
  special: AMMO[2]!.url,
  heavy: AMMO[3]!.url,
  hunter: classHunter,
  titan: classTitan,
  warlock: classWarlock,
};

const BRIGHT = "text-(color:--text)";

const TONES: Record<ClarityTone, string> = {
  pvp: "text-pvp",
  bold: "font-medium",
  named: BRIGHT,
};

const ICON = "mr-0.5 inline-block size-3 align-[-0.125em]";

const iconPath = (icon: ClarityIcon): string | undefined => {
  const damageType = DAMAGE_TYPES[icon];

  if (damageType !== undefined) {
    return defs()?.DamageType.getOptional(damageType)?.displayProperties.icon;
  }

  const breaker = BREAKERS[icon];

  if (breaker !== undefined) {
    return defs()?.BreakerType.getOptional(breaker)?.displayProperties.icon;
  }

  return undefined;
};

const Icon = (props: { icon: ClarityIcon }) => {
  const masked = MASKED[props.icon];

  if (masked !== undefined) {
    return (
      <span
        class={`${ICON} bg-current mask-contain mask-center mask-no-repeat`}
        style={{ "mask-image": `url("${masked}")` }}
      />
    );
  }

  return <BungieImage path={iconPath(props.icon)} class={ICON} />;
};

const spanOf = (span: ClaritySpan): JSX.Element => {
  if (span.kind === "icon") {
    return <Icon icon={span.icon} />;
  }

  if (span.kind === "number") {
    return <span class={BRIGHT}>{span.text}</span>;
  }

  if (span.kind === "pipe") {
    return <span class="px-0.5 opacity-60">|</span>;
  }

  if (span.kind === "enhanced") {
    return <span class="text-light">{span.text}</span>;
  }

  if (span.tones.length === 0) {
    return span.text;
  }

  return (
    <span class={span.tones.map((tone) => TONES[tone]).join(" ")}>
      {span.text}
    </span>
  );
};

/** A perk's Clarity text, in place of Bungie's description */
export const ClarityText = (props: { lines: ClarityLine[] }) => (
  <span class={PERK_TEXT}>
    <For each={props.lines}>
      {(line) => (
        <Show
          when={line.spans.length > 0}
          fallback={<span class="block h-2" />}
        >
          <Show
            when={line.bullet}
            fallback={
              <span class="block">
                <For each={line.spans}>{spanOf}</For>
              </span>
            }
          >
            <span class="mt-0.5 flex">
              <span class="w-3 flex-none">•</span>
              <span class="min-w-0">
                <For each={line.spans}>{spanOf}</For>
              </span>
            </span>
          </Show>
        </Show>
      )}
    </For>
  </span>
);
