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
import { Button } from "./ui/zaidan/button.tsx";
import { X } from "./ui/zaidan/icons.tsx";
import { Input } from "./ui/zaidan/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/zaidan/popover.tsx";

const SHORTEST = 3;

const DEBOUNCE = 300;

const CODE = /^\d{1,4}$/;

const ROW =
  "flex h-8 min-w-0 items-center rounded-md px-2 text-left hover:bg-accent";

const NOTE = "px-2 py-1 text-muted-foreground";

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
      <PopoverTrigger
        as={Button}
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground"
        title="View another Guardian"
        aria-label="View another Guardian"
      >
        <GuestGlyph />
      </PopoverTrigger>
      <PopoverContent data-menu="guest" class="w-80 gap-1 p-2">
        <Input
          class="mb-1"
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
                <p class={NOTE}>
                  Search for a Guardian to see their gear and history
                </p>
              }
            >
              <div class="flex max-h-80 flex-col overflow-y-auto">
                <For each={remembered()}>
                  {(who) => (
                    <div class="flex items-center gap-0.5">
                      <button
                        type="button"
                        class={`${ROW} flex-1`}
                        onClick={() => choose(who)}
                      >
                        <span class="truncate">{guestLabel(who)}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-muted-foreground"
                        title={who.pinned ? "Unpin" : "Pin"}
                        aria-label={who.pinned ? "Unpin" : "Pin"}
                        onClick={() =>
                          setRemembered(pinGuest(who, !who.pinned))
                        }
                      >
                        {who.pinned ? "★" : "☆"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-muted-foreground"
                        title="Remove"
                        aria-label="Remove"
                        onClick={() => setRemembered(forgetGuest(who))}
                      >
                        <X />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          }
        >
          <Show when={!found.loading} fallback={<p class={NOTE}>Searching</p>}>
            <Show
              when={found.error === undefined}
              fallback={
                <p class="px-2 py-1 text-destructive">
                  {messageOf(found.error)}
                </p>
              }
            >
              <Show
                when={results().length > 0}
                fallback={<p class={NOTE}>No matches</p>}
              >
                <div class="flex max-h-80 flex-col overflow-y-auto">
                  <For each={results()}>
                    {(who) => (
                      <button
                        type="button"
                        class={ROW}
                        onClick={() => choose(who)}
                      >
                        <span class="truncate">{guestLabel(who)}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </Show>
        </Show>
      </PopoverContent>
    </Popover>
  );
};
