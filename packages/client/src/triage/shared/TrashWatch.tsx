import { useBeforeLeave } from "@solidjs/router";
import { createEffect, on, Show } from "solid-js";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/lib/zaidan/alert-dialog.tsx";
import { Button } from "../../components/lib/zaidan/button.tsx";
import { WarningBanner } from "../../components/WarningBanner.tsx";
import { useApp } from "../../core/app/state.ts";
import {
  advanceTrash,
  bindTrash,
  dismissTrash,
  stopTrash,
  trashRun,
  trashStopping,
} from "./trashRun.ts";

/** Drives the trash run from any page */
export const TrashWatch = () => {
  const app = useApp();

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
        <WarningBanner
          title="Trash run interrupted"
          note={where()}
          action="Restore inventory"
          onAction={() => void stopTrash()}
        >
          <Button
            size="sm"
            variant="ghost"
            class="text-warning hover:bg-warning/15 hover:text-warning"
            onClick={dismissTrash}
          >
            Dismiss
          </Button>
        </WarningBanner>
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
