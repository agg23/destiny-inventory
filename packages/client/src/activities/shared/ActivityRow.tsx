import type { DimItem } from "app/inventory/item-types";
import { A, useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";

import { BungieImage } from "../../components/BungieImage.tsx";
import { MapGlyph } from "../../components/lib/MapGlyph.tsx";
import { SPENT } from "../../components/lib/text.ts";
import { Badge } from "../../components/lib/zaidan/badge.tsx";
import { TableCell, TableRow } from "../../components/lib/zaidan/table.tsx";
import {
  gearText,
  power,
  rewardsOf,
  rung,
  subline,
  topTier,
} from "../../core/activities/activityFormat.ts";
import { guideNamed } from "../../core/activities/guides.ts";
import type { Available, Loot } from "../../core/activities/types.ts";
import { trackPreview } from "../../core/items/preview.ts";
import { ago, duration } from "../../core/time.ts";
import { guideHref } from "../../core/url.ts";
import { Plate } from "../../history/shared/ActivityRow.tsx";
import type { Data } from "./activityData.ts";

// Nothing in the payload says this
const BASE_DROPS = 1;

const GLYPH = "shrink-0 object-contain";

export const Icon = (props: { icon: string | undefined; class: string }) => (
  <BungieImage
    path={props.icon}
    class={`${GLYPH} ${props.class}`}
    fallback={<span class={`${GLYPH} bg-muted ${props.class}`} />}
  />
);

const ChallengeMark = () => (
  <svg class="size-(--icon-xs)" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M8 1.5 14.5 8 8 14.5 1.5 8Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <circle cx="8" cy="8" r="2.4" fill="currentColor" />
  </svg>
);

interface NamedProps {
  loot: Loot;
  item: DimItem | undefined;
  spent: boolean;
  onHide: () => void;
}

const Named = (props: NamedProps) => {
  const tracked = trackPreview(() => props.item, {
    // Or the row under it re-anchors the activity panel onto this chip
    stopPropagation: true,
    onShow: () => props.onHide(),
  });

  return (
    <span
      class="flex max-w-44 min-w-0 items-center gap-1.5"
      classList={{ [SPENT]: props.spent }}
      title={props.loot.name}
      onMouseEnter={tracked.onMouseEnter}
      onMouseMove={tracked.onMouseMove}
      onMouseLeave={tracked.onMouseLeave}
    >
      <Icon
        icon={props.loot.icon}
        class={props.spent ? "size-(--icon-sm) opacity-60 grayscale" : "size-(--icon-sm)"}
      />
      <span class="truncate">{props.loot.name}</span>
      <Show when={props.loot.quantity > 1}>
        <span class="opacity-60">×{props.loot.quantity}</span>
      </Show>
    </span>
  );
};

const Dash = () => <span class="text-muted-foreground/60">-</span>;

export const Row = (props: { data: Data; entry: Available }) => {
  const navigate = useNavigate();
  const guide = () => guideNamed(props.entry.name);
  const timing = () => props.data.timingFor(props.entry);

  const hover = (event: MouseEvent & { currentTarget: HTMLElement }) =>
    props.data.onHover(props.entry, event.currentTarget, event.clientX);

  return (
    <TableRow
      classList={{ "cursor-pointer": !!guide() }}
      onMouseEnter={hover}
      onMouseMove={hover}
      onMouseLeave={() => props.data.onLeave(props.entry)}
      onClick={(event) => {
        const found = guide();

        // Last run and the Guide chip are links of their own
        if (!found || (event.target as Element).closest("a, button")) {
          return;
        }

        props.data.onLeave(props.entry);
        navigate(guideHref(found.name), { state: { inApp: true } });
      }}
    >
      <TableCell>
        <Plate
          name={props.entry.name}
          art={props.entry.pgcrImage}
          typeName={props.entry.typeName}
          badge={() => (
            <Show when={guide()}>
              {(found) => (
                <Badge
                  as={A}
                  variant="outline"
                  href={guideHref(found().name)}
                  state={{ inApp: true }}
                  onClick={() => props.data.onLeave(props.entry)}
                >
                  <span class="inline-block size-[1em]">
                    <MapGlyph />
                  </span>
                  Guide
                </Badge>
              )}
            </Show>
          )}
          subline={
            <span class="truncate text-xs text-muted-foreground">
              {subline(props.entry)}
            </span>
          }
        />
      </TableCell>
      <TableCell>
        <Show when={rung(props.entry)} fallback={<Dash />}>
          {(name) => name()}
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <Show when={power(props.entry)} fallback={<Dash />}>
          {(found) => found()}
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <span class="inline-flex items-center gap-2">
          <Icon icon={props.data.glyph()} class="size-(--icon-xs)" />
          <b class="text-foreground">{BASE_DROPS}</b>
          <Show when={props.entry.gear}>
            {(gear) => (
              <span
                classList={{
                  "font-semibold text-cream": topTier(gear()),
                  "text-muted-foreground": !topTier(gear()),
                }}
              >
                {gearText(gear())}
              </span>
            )}
          </Show>
          <Show when={props.entry.bonusDrops}>
            {(count) => <span class="text-cream">+{count()}</span>}
          </Show>
          <Show when={props.entry.dropsTaken}>
            {(count) => <span class={SPENT}>+{count()}</span>}
          </Show>
        </span>
      </TableCell>
      <TableCell>
        <Show when={rewardsOf(props.entry).length > 0} fallback={<Dash />}>
          <div class="flex min-w-0 items-center gap-4">
            <For each={rewardsOf(props.entry)}>
              {(one) => (
                <Named
                  loot={one.loot}
                  item={props.data.itemFor(one.loot)}
                  spent={one.spent}
                  onHide={() => props.data.onLeave(props.entry)}
                />
              )}
            </For>
          </div>
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <Show when={props.entry.challenges.length} fallback={<Dash />}>
          {(count) => (
            <span class="inline-flex items-center gap-1.5 text-cream">
              <ChallengeMark />
              {props.entry.challenges.filter((one) => !one.complete).length}/
              {count()}
            </span>
          )}
        </Show>
      </TableCell>
      <TableCell class="tabular-nums">
        <Show
          when={timing()}
          fallback={<span class="text-xs text-muted-foreground">Never run</span>}
        >
          {(found) => (
            <A
              href={props.data.hrefFor(found().lastRun)}
              class="group flex w-fit flex-col"
              onClick={() => props.data.onLeave(props.entry)}
            >
              <span class="group-hover:underline">
                {ago(found().lastRun.startedAt)}
              </span>
              <span class="text-xs text-muted-foreground">
                {found().runs} runs
                <Show when={found().fastestSeconds}>
                  {(fastest) => <> · {duration(fastest())}</>}
                </Show>
              </span>
            </A>
          )}
        </Show>
      </TableCell>
    </TableRow>
  );
};
