import type { DimItem } from "app/inventory/item-types";
import { A } from "@solidjs/router";
import { For, Show } from "solid-js";

import { ItemTile } from "../../components/ItemTile.tsx";
import { CARD, TILE_GRID } from "../../components/lib/text.ts";
import type { Span } from "../../core/stats/attribute.ts";
import { plural } from "../../core/text.ts";
import { dateTime, duration } from "../../core/time.ts";
import { Delta } from "./Delta.tsx";
import { dropsOf, type ActivityDigest } from "./statData.ts";

const GAINS_SHOWN = 6;

interface Props {
  digests: ActivityDigest[];
  now: number;
  itemOf: (instanceId: string, itemHash: number) => DimItem | undefined;
  nameOf: (hash: number) => string;
  spanName: (span: Span) => string;
  spanHref: (span: Span) => string | undefined;
  classOf: (characterId: string) => string | undefined;
  deathsOf: (span: Span) => number | undefined;
  onSelect: (item: DimItem) => void;
}

/** Kills from the trackers, deaths from the run once History has it */
export const combat = (
  kills: number,
  deaths: number | undefined,
): string | undefined => {
  const parts = [
    ...(kills > 0 ? [plural(kills, "kill")] : []),
    ...(deaths === undefined ? [] : [plural(deaths, "death")]),
  ];

  return parts.length > 0 ? parts.join(" · ") : undefined;
};

/** The id an activity card carries, for the strip to scroll to */
export const cardId = (key: string) => `activity-${key}`;

/** Activity name, or what stands in for one */
export const digestTitle = (
  digest: ActivityDigest,
  spanName: (span: Span) => string,
): string => {
  if (digest.away) {
    return "While away";
  }

  return digest.span ? spanName(digest.span) : "Outside a recorded activity";
};

/** Class, start, and length, or the away window */
export const digestFacts = (
  digest: ActivityDigest,
  now: number,
  classOf: (characterId: string) => string | undefined,
): string[] => {
  if (digest.away) {
    return [`${dateTime(digest.away.from)} - ${dateTime(digest.away.at)}`];
  }

  const span = digest.span;

  if (!span) {
    return [];
  }

  const ended = span.endedAt ?? now;

  return [
    classOf(span.characterId) ?? "",
    dateTime(span.startedAt),
    span.endedAt === undefined
      ? `${duration((ended - span.startedAt) / 1000)} so far`
      : duration((ended - span.startedAt) / 1000),
  ].filter((fact) => fact !== "");
};

/** Drops, the attribution note, and currency, shared by the card and the strip panel */
export const DigestBody = (props: {
  digest: ActivityDigest;
  itemOf: (instanceId: string, itemHash: number) => DimItem | undefined;
  nameOf: (hash: number) => string;
  spanName: (span: Span) => string;
  onSelect?: (item: DimItem) => void;
}) => {
  const ambiguous = (): string | undefined => {
    const unsure = dropsOf(props.digest).filter((drop) => drop.alternative);
    const other = unsure[0]?.alternative;

    if (!other) {
      return undefined;
    }

    return `${plural(unsure.length, "drop")} may be from ${props.spanName(other)}`;
  };

  return (
    <>
      <Show when={dropsOf(props.digest).length > 0}>
        <div class={TILE_GRID}>
          <For each={dropsOf(props.digest)}>
            {(drop) => (
              <Show when={props.itemOf(drop.instanceId, drop.itemHash)}>
                {(item) => (
                  <ItemTile
                    item={item()}
                    highlight={!!props.onSelect}
                    onSelect={props.onSelect}
                  />
                )}
              </Show>
            )}
          </For>
        </div>
      </Show>

      <Show when={ambiguous()}>
        {(note) => <span class="text-xs text-muted-foreground">{note()}</span>}
      </Show>

      <Show when={props.digest.gains.length > 0}>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <For each={props.digest.gains.slice(0, GAINS_SHOWN)}>
            {(gain) => (
              <span class="inline-flex items-baseline gap-1.5">
                <span class="text-muted-foreground">
                  {props.nameOf(gain.itemHash)}
                </span>
                <Delta value={gain.delta} />
              </span>
            )}
          </For>
        </div>
      </Show>
    </>
  );
};

export const ActivityList = (props: Props) => (
  <div class="flex flex-col gap-2">
    <For each={props.digests}>
      {(digest) => (
        <div id={cardId(digest.key)} class={`${CARD} scroll-mt-16`}>
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Show
              when={digest.span && props.spanHref(digest.span)}
              fallback={
                <span class="font-medium">
                  {digestTitle(digest, props.spanName)}
                </span>
              }
            >
              {(href) => (
                <A href={href()} class="font-medium hover:underline">
                  {digestTitle(digest, props.spanName)}
                </A>
              )}
            </Show>
            <span class="text-xs text-muted-foreground tabular-nums">
              {digestFacts(digest, props.now, props.classOf).join(" · ")}
            </span>
            <Show
              when={combat(
                digest.kills,
                digest.span ? props.deathsOf(digest.span) : undefined,
              )}
            >
              {(text) => (
                <span class="ml-auto text-xs text-muted-foreground tabular-nums">
                  {text()}
                </span>
              )}
            </Show>
          </div>

          <DigestBody
            digest={digest}
            itemOf={props.itemOf}
            nameOf={props.nameOf}
            spanName={props.spanName}
            onSelect={props.onSelect}
          />
        </div>
      )}
    </For>
  </div>
);
