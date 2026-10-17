import { A } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  Show,
  type JSX,
} from "solid-js";
import { Dynamic } from "solid-js/web";

import { previewDemo } from "../../core/app/preview.ts";
import { useApp } from "../../core/app/state.ts";
import { useClock } from "../../core/clock.ts";
import { held } from "../../core/held.ts";
import {
  cachedVendorNotices,
  pollVendors,
  vendorsFetching,
} from "../../core/noticeCache.ts";
import {
  demoNotices,
  profileNotices,
  rankNotices,
  summaries,
  type Category,
  type Priority,
  type Summary,
  type Tone,
} from "../../core/notices.ts";
import { defs } from "../../core/profile/defs.ts";
import { MINUTE } from "../../core/time.ts";
import { remaining } from "../../core/todo/reset.ts";
import { tabHref } from "../../core/url.ts";
import { OrderGlyph } from "../lib/OrderGlyph.tsx";
import { PostmasterGlyph } from "../lib/PostmasterGlyph.tsx";
import { VendorGlyph } from "../lib/VendorGlyph.tsx";
import { Popover, PopoverContent } from "../lib/zaidan/popover.tsx";
import { CurrentActivity } from "./CurrentActivity.tsx";

// Passing the pointer along the strip shouldn't flash every detail
const HOVER_DELAY = 300;

// Time to move the pointer from a cell into its detail
const HOVER_GRACE = 150;

const LABELS: Record<Category, string> = {
  postmaster: "Postmaster",
  orders: "Orders",
  vendors: "Vendors",
};

const GLYPHS: Record<Category, (props: { class?: string }) => JSX.Element> = {
  postmaster: PostmasterGlyph,
  orders: OrderGlyph,
  vendors: VendorGlyph,
};

// Measured off rendered pixels. 1 and 4 read by their stems rather than their ink box, and the
// baseline snaps a quarter pixel high, which is where optical center sits anyway
const DIGIT_NUDGE: Record<number, number> = { 1: -0.5, 4: -0.3 };

const TONES: Record<Tone, string> = {
  urgent: "text-destructive",
  ready: "text-foreground",
  rest: "text-muted-foreground",
};

const NOTICE_TONES: Record<Priority, Tone> = {
  urgent: "urgent",
  shown: "ready",
  hidden: "rest",
};

const Cell = (props: {
  summary: Summary;
  now: number;
  online: boolean;
  anchor: () => HTMLElement | undefined;
}) => {
  const [open, setOpen] = createSignal(false);
  let timer: number | undefined = undefined;

  const enter = (delay: number) => {
    window.clearTimeout(timer);

    if (props.online && props.summary.notices.length > 0) {
      timer = window.setTimeout(() => setOpen(true), delay);
    }
  };

  const leave = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setOpen(false), HOVER_GRACE);
  };

  onCleanup(() => window.clearTimeout(timer));

  const tone = (): Tone => (props.online ? props.summary.tone : "rest");

  return (
    <Popover
      open={open()}
      onOpenChange={setOpen}
      anchorRef={props.anchor}
      placement="left-start"
      gutter={8}
    >
      <A
        href={tabHref(props.summary.tab)}
        class="flex h-9 min-w-0 items-center justify-center gap-1.5 hover:bg-accent"
        classList={{ "bg-accent": open() }}
        onPointerEnter={() => enter(HOVER_DELAY)}
        onPointerLeave={leave}
      >
        {/* The indicator takes the glyph's place so the centered pair never changes size */}
        <span class="relative flex size-3.5 shrink-0 items-center justify-center">
          <Show
            when={props.online ? props.summary.count : undefined}
            fallback={
              <Dynamic
                component={GLYPHS[props.summary.category]}
                class={`size-3.5 ${tone() === "rest" ? "text-muted-foreground/60" : "text-foreground"}`}
              />
            }
          >
            {(count) => (
              <svg
                viewBox="0 0 14 14"
                class="size-3.5"
                role="img"
                aria-label={`${count()} urgent`}
              >
                <circle cx="7" cy="7" r="7" class="fill-(--d2-danger)" />
                <text
                  x={7 + (DIGIT_NUDGE[Math.min(count(), 9)] ?? 0)}
                  y="10.65"
                  text-anchor="middle"
                  font-size="10"
                  font-weight="600"
                  class="fill-white"
                >
                  {Math.min(count(), 9)}
                </text>
              </svg>
            )}
          </Show>
          <Show when={props.online && tone() === "ready"}>
            <span class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-muted-foreground ring-2 ring-card" />
          </Show>
        </span>
        <span
          class="text-xs"
          classList={{
            "text-foreground": tone() !== "rest",
            "text-muted-foreground": tone() === "rest",
          }}
        >
          {LABELS[props.summary.category]}
        </span>
      </A>
      <PopoverContent
        class="w-72 p-1"
        onPointerEnter={() => enter(0)}
        onPointerLeave={leave}
        onOpenAutoFocus={(event: Event) => event.preventDefault()}
      >
        <p class="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
          {LABELS[props.summary.category]}
        </p>
        <ul class="flex flex-col">
          <For each={props.summary.notices}>
            {(notice) => (
              <li>
                <A
                  href={tabHref(notice.tab)}
                  class="flex h-7 min-w-0 items-center gap-2 rounded-sm px-2 hover:bg-accent"
                >
                  <span
                    class="min-w-0 flex-1 truncate"
                    classList={{
                      "text-muted-foreground": notice.priority === "hidden",
                    }}
                  >
                    {notice.name}
                  </span>
                  <span
                    class={`shrink-0 text-xs whitespace-nowrap ${TONES[NOTICE_TONES[notice.priority]]}`}
                  >
                    {notice.detail}
                    <Show when={notice.endsAt}>
                      {(at) => (
                        <span class="tabular-nums">
                          {" "}
                          · {remaining(at() - props.now)}
                        </span>
                      )}
                    </Show>
                  </span>
                </A>
              </li>
            )}
          </For>
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export const Status = () => {
  const app = useApp();
  const now = useClock();
  const settled = createMemo(() => Math.floor(now() / MINUTE) * MINUTE);
  let card: HTMLDivElement | undefined = undefined;

  const store = () => app.stores().find((one) => one.id === app.playing());

  createEffect(() => {
    const playing = store();
    const loaded = app.loaded();

    if (playing && loaded && defs() && !previewDemo()) {
      void pollVendors(loaded, playing, settled());
    }
  });

  const cells = createMemo(
    () => {
      const playing = store();
      const loaded = app.loaded();

      if (!playing || !loaded) {
        return summaries([]);
      }

      const notices = previewDemo()
        ? demoNotices(playing, settled())
        : [
            ...profileNotices(playing, loaded, settled()),
            ...cachedVendorNotices(playing.id),
          ];

      return summaries(rankNotices(notices, settled()));
    },
    undefined,
    held<Summary>(),
  );

  return (
    <div
      ref={card}
      class="mx-4 mt-4 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10"
    >
      <div class="bg-muted">
        <CurrentActivity loading={vendorsFetching() || app.refreshing()} />
      </div>
      <ul class="grid grid-cols-3 divide-x border-t">
        <Index each={cells()}>
          {(summary) => (
            <li class="min-w-0">
              <Cell
                summary={summary()}
                now={now()}
                online={!!store()}
                anchor={() => card}
              />
            </li>
          )}
        </Index>
      </ul>
    </div>
  );
};
