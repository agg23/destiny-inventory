import { Popover } from "@kobalte/core/popover";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";

import { searchPlayers } from "./bungie.ts";
import { messageOf } from "./error.ts";
import {
  forgetGuest,
  guestLabel,
  pinGuest,
  rememberedGuests,
  type Guest,
} from "./guest.ts";
import { GuestGlyph } from "./ui/GuestGlyph.tsx";

const SHORTEST = 3;

const DEBOUNCE = 300;

const CODE = /^\d{1,4}$/;

const ROW =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm tracking-caps text-text hover:bg-surface-active hover:text-fg";

export const GuestPicker = (props: { onChoose: (who: Guest) => void }) => {
  const [open, setOpen] = createSignal(false);
  const [typed, setTyped] = createSignal("");
  const [term, setTerm] = createSignal("");
  const [remembered, setRemembered] = createSignal<Guest[]>([]);

  let timer: number | undefined = undefined;

  const onType = (value: string) => {
    setTyped(value);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setTerm(value.trim()), DEBOUNCE);
  };

  const prefix = () => term().split("#")[0] ?? "";
  const code = () => term().split("#")[1];

  const [found] = createResource(
    () => (prefix().length >= SHORTEST ? prefix() : undefined),
    (wanted) => searchPlayers(wanted),
  );

  const results = createMemo<Guest[]>(() => {
    const wanted = code();
    const players = found.error === undefined ? found() ?? [] : [];

    return players
      .filter(
        (player) =>
          wanted === undefined ||
          !CODE.test(wanted) ||
          player.code === Number(wanted),
      )
      .map((player) => ({
        ...player.membership,
        name: player.name,
        code: player.code,
        pinned: false,
      }));
  });

  const searching = () => prefix().length >= SHORTEST;

  const onOpenChange = (next: boolean) => {
    if (next) {
      setRemembered(rememberedGuests());
      setTyped("");
      setTerm("");
    }

    setOpen(next);
  };

  const choose = (who: Guest) => {
    setOpen(false);
    props.onChoose(who);
  };

  return (
    <Popover
      open={open()}
      onOpenChange={onOpenChange}
      gutter={6}
      placement="bottom-end"
    >
      <Popover.Trigger
        class="header-action"
        title="View another Guardian"
        aria-label="View another Guardian"
      >
        <GuestGlyph />
      </Popover.Trigger>
      <Popover.Portal>
        <div class="settings-scrim" />
        <Popover.Content data-menu="guest" class="settings-panel guest-panel">
          <input
            class="text-input inline"
            type="search"
            autofocus
            placeholder="Bungie name"
            value={typed()}
            onInput={(e) => onType(e.currentTarget.value)}
          />

          <Show
            when={searching()}
            fallback={
              <Show
                when={remembered().length > 0}
                fallback={
                  <p class="px-3 text-sm text-muted">
                    Search for a Guardian to see their gear and history
                  </p>
                }
              >
                <div class="guest-list">
                  <For each={remembered()}>
                    {(who) => (
                      <div class="flex items-center">
                        <button
                          type="button"
                          class={ROW}
                          onClick={() => choose(who)}
                        >
                          <span class="min-w-0 flex-1 truncate">
                            {guestLabel(who)}
                          </span>
                        </button>
                        <button
                          type="button"
                          class="header-action"
                          title={who.pinned ? "Unpin" : "Pin"}
                          aria-label={who.pinned ? "Unpin" : "Pin"}
                          onClick={() =>
                            setRemembered(pinGuest(who, !who.pinned))
                          }
                        >
                          {who.pinned ? "★" : "☆"}
                        </button>
                        <button
                          type="button"
                          class="header-action"
                          title="Remove"
                          aria-label="Remove"
                          onClick={() => setRemembered(forgetGuest(who))}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            }
          >
            <Show
              when={!found.loading}
              fallback={<p class="px-3 text-sm text-muted">Searching</p>}
            >
              <Show
                when={found.error === undefined}
                fallback={
                  <p class="px-3 text-sm text-danger">
                    {messageOf(found.error)}
                  </p>
                }
              >
                <Show
                  when={results().length > 0}
                  fallback={<p class="px-3 text-sm text-muted">No matches</p>}
                >
                  <div class="guest-list">
                    <For each={results()}>
                      {(who) => (
                        <button
                          type="button"
                          class={ROW}
                          onClick={() => choose(who)}
                        >
                          <span class="min-w-0 flex-1 truncate">
                            {guestLabel(who)}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};
