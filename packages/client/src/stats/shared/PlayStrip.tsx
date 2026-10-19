import { createSignal, For, Show, type JSX } from "solid-js";

import { AnchoredPanel } from "../../components/lib/AnchoredPanel.tsx";
import { createHoverCard } from "../../core/items/preview.ts";
import { shortDay, shortTime, span } from "../../core/time.ts";
import { PANEL } from "../../activities/shared/RunDetail.tsx";
import type { PlayDay } from "./statData.ts";
import type { Break, Timeline } from "./timeline.ts";

const BREAK = "break/";

// Percent of the width between two session labels
const LABEL_ROOM = 8;

export interface StripBlock {
  key: string;
  startedAt: number;
  endedAt: number;
  name: string;
  social: boolean;
}

export interface StripMark {
  key: string;
  at: number;
  color: string;
  dismantle: boolean;
}

const BreakNote = (props: { gap: Break | undefined }) => (
  <Show when={props.gap}>
    {(gap) => (
      <span class="text-sm">
        Offline {span((gap().to - gap().from) / 1000)}
        <span class="text-muted-foreground">
          {" "}
          · {shortTime(gap().from)} - {shortTime(gap().to)}
        </span>
      </span>
    )}
  </Show>
);

/** Activities as blocks on one clock, drops and dismantles as dots under them */
export const DayStrip = (props: {
  timeline: Timeline;
  blocks: StripBlock[];
  marks: StripMark[];
  panel: (key: string) => JSX.Element;
  onPick: (key: string) => void;
  onMarkEnter: (key: string, element: HTMLElement) => void;
  onMarkLeave: (key: string) => void;
}) => {
  const card = createHoverCard<string>({});
  const [cursorX, setCursorX] = createSignal(0);

  const at = (time: number) => props.timeline.toX(time) * 100;

  // Session starts, skipping any too close to the last to read
  const labels = () => {
    const shown: { x: number; text: string }[] = [];

    for (const session of props.timeline.sessions) {
      const x = at(session.from);

      if (shown.length === 0 || x - shown.at(-1)!.x >= LABEL_ROOM) {
        shown.push({ x, text: shortTime(session.from) });
      }
    }

    return shown;
  };

  const end = () => props.timeline.sessions.at(-1)?.to ?? 0;

  return (
    <div class="flex flex-col gap-1">
      <div class="relative h-7 overflow-hidden rounded-md bg-muted/40">
        <For each={props.blocks}>
          {(block) => (
            <button
              type="button"
              class="absolute inset-y-0 truncate border-r border-background px-1.5 text-left text-xs"
              classList={{
                "bg-foreground/20 hover:bg-foreground/30": !block.social,
                "bg-foreground/8 text-muted-foreground hover:bg-foreground/15":
                  block.social,
              }}
              style={{
                left: `${at(block.startedAt)}%`,
                width: `${at(block.endedAt) - at(block.startedAt)}%`,
              }}
              onMouseEnter={(event) => {
                setCursorX(event.clientX);
                card.open(block.key, event.currentTarget);
              }}
              onMouseMove={(event) => setCursorX(event.clientX)}
              onMouseLeave={card.clear}
              onClick={() => props.onPick(block.key)}
            >
              {block.name}
            </button>
          )}
        </For>
        <For each={props.timeline.breaks}>
          {(gap, index) => (
            <span
              class="absolute inset-y-0 w-2 -translate-x-1/2 bg-background"
              style={{ left: `${gap.x * 100}%` }}
              onMouseEnter={(event) => {
                setCursorX(event.clientX);
                card.open(`${BREAK}${index()}`, event.currentTarget);
              }}
              onMouseLeave={card.clear}
            />
          )}
        </For>
      </div>

      <div class="relative h-4">
        <For each={props.marks}>
          {(mark) => (
            <button
              type="button"
              class="absolute top-0 flex size-4 -translate-x-1/2 items-center justify-center"
              style={{ left: `${at(mark.at)}%` }}
              aria-label={mark.dismantle ? "Dismantle" : "Drop"}
              onMouseEnter={(event) =>
                props.onMarkEnter(mark.key, event.currentTarget)
              }
              onMouseLeave={() => props.onMarkLeave(mark.key)}
            >
              <span
                class="size-2 rounded-full"
                classList={{ "border border-muted-foreground": mark.dismantle }}
                style={{
                  background: mark.dismantle ? "transparent" : mark.color,
                }}
              />
            </button>
          )}
        </For>
      </div>

      <div class="relative h-4 text-xs text-muted-foreground tabular-nums">
        <For each={labels()}>
          {(label) => (
            <span class="absolute" style={{ left: `${label.x}%` }}>
              {label.text}
            </span>
          )}
        </For>
        <span class="absolute right-0">{shortTime(end())}</span>
      </div>

      <Show when={card.shown()}>
        {(key) => (
          <AnchoredPanel class={PANEL} cursorX={cursorX()}>
            <Show when={key().startsWith(BREAK)} fallback={props.panel(key())}>
              <BreakNote
                gap={props.timeline.breaks[Number(key().slice(BREAK.length))]}
              />
            </Show>
          </AnchoredPanel>
        )}
      </Show>
    </div>
  );
};

/** One column per day, sized by time played, activities under social spaces */
export const DaysStrip = (props: {
  days: PlayDay[];
  panel: (day: PlayDay) => JSX.Element;
  onDay: (day: string) => void;
}) => {
  const card = createHoverCard<PlayDay>({
    reopen: (shown, next) => shown.day === next.day,
  });

  const tallest = () =>
    Math.max(1, ...props.days.map((day) => day.active + day.social));

  return (
    <div class="flex flex-col gap-1">
      <div class="flex h-16 items-end gap-px">
        <For each={props.days}>
          {(day) => (
            <button
              type="button"
              class="flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm hover:bg-foreground/5"
              aria-label={shortDay(day.start)}
              onMouseEnter={(event) => card.open(day, event.currentTarget)}
              onMouseLeave={card.clear}
              onClick={() => props.onDay(day.day)}
            >
              <span
                class="w-full bg-foreground/10"
                style={{ height: `${(day.social / tallest()) * 100}%` }}
              />
              <span
                class="w-full bg-foreground/30"
                style={{ height: `${(day.active / tallest()) * 100}%` }}
              />
            </button>
          )}
        </For>
      </div>

      <div class="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{props.days[0] ? shortDay(props.days[0].start) : ""}</span>
        <span>
          {props.days.at(-1) ? shortDay(props.days.at(-1)!.start) : ""}
        </span>
      </div>

      <Show when={card.shown()}>
        {(day) => (
          <AnchoredPanel class={PANEL}>{props.panel(day())}</AnchoredPanel>
        )}
      </Show>
    </div>
  );
};
