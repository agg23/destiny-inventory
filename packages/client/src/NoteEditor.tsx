import type { DimItem } from "app/inventory/item-types";
import { useBeforeLeave } from "@solidjs/router";
import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";

import { useApp } from "./App.tsx";
import {
  collections,
  definedSession,
  entryForHash,
  primeCollections,
} from "./collections.ts";
import { MAX_NOTE_LENGTH, noteFor, saveNote, type NoteTarget } from "./notes.ts";
import { Button } from "./ui/Button.tsx";
import { readParam } from "./url.ts";

const LEAVE_PROMPT = "You have an unsaved note. Leave without saving?";

const unsaved = new Map<symbol, (to: URL) => boolean>();

const guard = (event: BeforeUnloadEvent) => {
  event.preventDefault();
};

const markUnsaved = (
  editor: symbol,
  discards: ((to: URL) => boolean) | undefined,
) => {
  if (discards) {
    unsaved.set(editor, discards);
  } else {
    unsaved.delete(editor);
  }

  if (unsaved.size > 0) {
    window.addEventListener("beforeunload", guard);
  } else {
    window.removeEventListener("beforeunload", guard);
  }
};

const pinnedIn = (search: string): string[] =>
  readParam("pin", new URLSearchParams(search).get("pin") ?? undefined);

/** Asks before an in-app navigation that would drop an unsaved note. Call once, inside the router */
export const useNoteLeaveGuard = () =>
  useBeforeLeave((event) => {
    if (event.defaultPrevented || unsaved.size === 0) {
      return;
    }

    // Back and forward arrive as a history delta
    const discarding =
      typeof event.to === "number" ||
      [...unsaved.values()].some((discards) =>
        discards(new URL(event.to as string, location.origin)),
      );

    if (discarding && !window.confirm(LEAVE_PROMPT)) {
      event.preventDefault();
    }
  });

/** A note with an explicit save. A blank save clears it */
export const NoteEditor = (props: { target: NoteTarget }) => {
  const [draft, setDraft] = createSignal<string | undefined>(undefined);
  const [saving, setSaving] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  const key = () => `${props.target.kind}/${props.target.targetId}`;
  const saved = () => noteFor(props.target) ?? "";
  const text = () => draft() ?? saved();
  const dirty = () => draft() !== undefined && draft() !== saved();

  const revert = () => {
    setDraft(undefined);
    setFailed(false);
  };

  createEffect(on(key, revert, { defer: true }));

  const discards = (to: URL): boolean => {
    if (to.pathname !== location.pathname) {
      return true;
    }

    const id = props.target.targetId;

    return (
      props.target.kind === "instance" &&
      pinnedIn(location.search).includes(id) &&
      !pinnedIn(to.search).includes(id)
    );
  };

  const editor = Symbol();

  createEffect(() => markUnsaved(editor, dirty() ? discards : undefined));
  onCleanup(() => markUnsaved(editor, undefined));

  const submit = async () => {
    setSaving(true);
    setFailed(false);

    const asked = key();
    const ok = await saveNote(props.target, text());

    setSaving(false);

    // Moved on to another item while the save was in flight
    if (asked !== key()) {
      return;
    }

    if (ok) {
      setDraft(undefined);
    } else {
      setFailed(true);
    }
  };

  return (
    <div class="flex flex-col gap-1.5">
      <textarea
        class="text-area"
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Add a note"
        aria-label="Note"
        value={text()}
        onInput={(event) => setDraft(event.currentTarget.value)}
      />
      <Show when={dirty() || failed()}>
        <div class="flex items-center gap-2">
          <Button size="xs" disabled={saving()} onClick={() => void submit()}>
            Save
          </Button>
          <Button size="xs" variant="ghost" disabled={saving()} onClick={revert}>
            Revert
          </Button>
          <Show when={failed()}>
            <span class="text-sm text-error">Couldn't save</span>
          </Show>
        </div>
      </Show>
    </div>
  );
};

/** The Collections note every copy of an item shares, or its armor set's */
export const SharedNote = (props: { item: DimItem }) => {
  const app = useApp();

  createEffect(() => {
    const session = definedSession(app.loaded()?.session);

    if (session && !collections()) {
      // The note just won't show
      primeCollections(session).catch(() => undefined);
    }
  });

  const target = (): NoteTarget | undefined => {
    const index = collections();
    const entry = index ? entryForHash(index, props.item.hash) : undefined;

    if (!entry) {
      return undefined;
    }

    return entry.kind === "armor" && entry.setKey !== undefined
      ? { kind: "set", targetId: entry.setKey }
      : { kind: "item", targetId: entry.key };
  };

  const note = () => {
    const found = target();

    return found ? noteFor(found) : undefined;
  };

  return (
    <Show when={note()}>
      {(found) => (
        <div class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-caps text-dim">
            {target()?.kind === "set" ? "Set note" : "All copies"}
          </span>
          <p class="note-text text-sm">{found()}</p>
        </div>
      )}
    </Show>
  );
};
