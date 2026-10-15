import { useBeforeLeave } from "@solidjs/router";
import { createEffect, on, Show } from "solid-js";

import type { AppState } from "../App.tsx";
import {
  advanceTrash,
  bindTrash,
  dismissTrash,
  stopTrash,
  trashRun,
  trashStopping,
} from "./trashRun.ts";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/zaidan/alert-dialog.tsx";
import { Button } from "../ui/zaidan/button.tsx";

/** Drives the trash run from any page, guards leaving it, and offers recovery */
export const TrashWatch = (props: { app: AppState }) => {
  const app = props.app;

  bindTrash(app);

  createEffect(on([app.stores, app.playing], () => void advanceTrash()));

  useBeforeLeave((event) => {
    const held = trashRun();

    if (event.defaultPrevented || !held || held.interrupted) {
      return;
    }

    // Back and forward arrive as a history delta
    if (typeof event.to === "string") {
      const to = new URL(event.to, location.origin);

      if (
        to.pathname === "/triage" &&
        to.searchParams.get("step") === "trash"
      ) {
        return;
      }
    }

    event.preventDefault();

    if (trashStopping()) {
      return;
    }

    void stopTrash().then(() => event.retry(true));
  });

  const where = () => {
    const held = trashRun();

    if (!held) {
      return "";
    }

    const bucket = app.loaded()?.buckets.byHash[held.bucketHash];
    const character = app
      .stores()
      .find((store) => store.id === held.characterId);

    return [bucket?.name, character?.className, held.dry ? "Dry run" : ""]
      .filter((part) => part)
      .join(" · ");
  };

  return (
    <>
      <Show when={trashRun()?.interrupted}>
        <div class="flex h-10 items-center gap-3 border-b border-warning/40 bg-warning/15 px-4 text-warning">
          <span class="font-medium">Trash run interrupted</span>
          <span class="mr-auto text-warning/70">{where()}</span>
          <Button
            size="sm"
            variant="outline"
            class="border-warning/40 text-warning hover:bg-warning/15 hover:text-warning"
            onClick={() => void stopTrash()}
          >
            Restore inventory
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="text-warning hover:bg-warning/15 hover:text-warning"
            onClick={dismissTrash}
          >
            Dismiss
          </Button>
        </div>
      </Show>

      <AlertDialog open={trashStopping()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Putting things back</AlertDialogTitle>
            <AlertDialogDescription>
              {app.moving() ?? where()}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
