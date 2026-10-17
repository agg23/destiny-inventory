import { createMemo, createSignal, For, Show } from "solid-js";

import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import { ItemTile } from "../../components/ItemTile.tsx";
import { Objective } from "../../components/lib/Progress.tsx";
import { HEADING, TILE_GRID } from "../../components/lib/text.ts";
import {
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/lib/zaidan/alert-dialog.tsx";
import { Button } from "../../components/lib/zaidan/button.tsx";
import { NameCounts } from "../../components/NameCounts.tsx";
import { useApp } from "../../core/app/state.ts";
import { guest } from "../../core/profile/guest.ts";
import { plural } from "../../core/text.ts";
import { showToast } from "../../core/toast.ts";
import {
  planTrash,
  trashFor,
  trashQueue,
  type TrashPhase,
} from "./trashPlan.ts";
import {
  nextTrash,
  startTrash,
  stopTrash,
  trashPaused,
  trashRun,
  trashStopping,
} from "./trashRun.ts";
import { CATEGORIES } from "./triage.ts";

const PHASE_LABELS: Record<TrashPhase, string> = {
  evacuating: "Clearing the slot",
  feeding: "Loading junk",
  waiting: "Dismantle these in game",
  restoring: "Putting things back",
};

export const TriageTrash = (props: { dry: boolean }) => {
  const app = useApp();

  const slots = createMemo(() => {
    const table = app.loaded()?.buckets;

    return CATEGORIES.flatMap((category) => table?.byCategory[category] ?? []);
  });

  const counts = createMemo(() => {
    const character = app.active();
    const stores = app.stores();

    return new Map(
      slots().map((bucket) => [
        bucket.hash,
        character ? trashFor(stores, character, bucket.hash).length : 0,
      ]),
    );
  });

  const inGame = () => app.playing() === app.active()?.id;

  const ready = () =>
    app.active() !== undefined &&
    guest() === undefined &&
    trashRun() === undefined &&
    (props.dry || inGame());

  const [confirming, setConfirming] = createSignal<number | undefined>(
    undefined,
  );

  const plan = createMemo(() => {
    const bucketHash = confirming();
    const character = app.active();

    return bucketHash === undefined || !character
      ? undefined
      : planTrash(app.stores(), character, bucketHash);
  });

  const onStart = () => {
    const bucketHash = confirming();
    const character = app.active();

    setConfirming(undefined);

    if (bucketHash === undefined || !character) {
      return;
    }

    const error = startTrash(character, bucketHash, props.dry);

    if (error) {
      showToast(error, "danger");
    }
  };

  const live = () => {
    const held = trashRun();

    return held && !held.interrupted ? held : undefined;
  };

  const character = () =>
    app.stores().find((store) => store.id === live()?.characterId);

  const fed = createMemo(() => {
    const items = new Map(
      app
        .stores()
        .flatMap((store) => store.items)
        .map((item) => [item.id, item]),
    );

    return (live()?.fed ?? []).flatMap((one) => {
      const item = items.get(one.instanceId);

      return item ? [item] : [];
    });
  });

  const progress = () => {
    const held = live();
    const owner = character();

    if (!held || !owner) {
      return { done: 0, total: 0 };
    }

    const done = held.dismantled.length;

    return {
      done,
      total:
        done + held.fed.length + trashQueue(held, app.stores(), owner).length,
    };
  };

  const status = () => {
    const held = live();

    if (!held) {
      return "";
    }

    if (app.moving()) {
      return app.moving();
    }

    if (trashPaused()) {
      return `Paused · ${character()?.className ?? "Character"} isn't in game`;
    }

    return PHASE_LABELS[held.phase];
  };

  return (
    <>
      <ConfirmDialog
        value={plan()}
        onClose={() => setConfirming(undefined)}
        action="Start"
        disabled={plan()?.blocked !== undefined}
        onAction={onStart}
      >
        {(held) => (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Trash {plural(held().trash.length, "item")}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {[
                  app.loaded()?.buckets.byHash[confirming()!]?.name,
                  app.active()?.className,
                  props.dry ? "Dry run" : "",
                ]
                  .filter((part) => part)
                  .join(" · ")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div class="flex flex-col gap-1.5 text-sm">
              <span class="text-muted-foreground">To dismantle</span>
              <NameCounts
                items={held().trash}
                class="max-h-40 overflow-y-auto"
              />
            </div>
            <Show when={held().blocked}>
              {(reason) => <p class="text-sm text-destructive">{reason()}</p>}
            </Show>
          </>
        )}
      </ConfirmDialog>

      <Show
        when={live()}
        fallback={
          <div class="flex flex-col gap-2 px-4 pt-3 pb-4">
            <div class="flex flex-wrap gap-2">
              <For each={slots()}>
                {(bucket) => (
                  <Button
                    variant="outline"
                    disabled={!ready() || counts().get(bucket.hash) === 0}
                    onClick={() => setConfirming(bucket.hash)}
                  >
                    {bucket.name}
                    <span class="text-muted-foreground tabular-nums">
                      {counts().get(bucket.hash)}
                    </span>
                  </Button>
                )}
              </For>
            </div>

            <Show
              when={
                !props.dry && !inGame() && app.active() && guest() === undefined
              }
            >
              <p class="text-muted-foreground">
                The expected character ({app.active()?.className}) isn't in game. You must open the game to start dismantling.
              </p>
            </Show>
          </div>
        }
      >
        {(held) => (
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 class={HEADING}>
                {app.loaded()?.buckets.byHash[held().bucketHash]?.name}
              </h2>
              <span class="text-muted-foreground">{status()}</span>
              <span class="ml-auto flex gap-2">
                <Button
                  size="sm"
                  disabled={
                    app.moving() !== undefined ||
                    held().phase !== "waiting" ||
                    trashPaused()
                  }
                  onClick={() => void nextTrash()}
                >
                  Begin next batch
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={trashStopping() || held().phase === "restoring"}
                  onClick={() => void stopTrash()}
                >
                  Stop
                </Button>
              </span>
            </div>

            <Objective
              label="Dismantled"
              progress={progress().done}
              goal={progress().total}
              class="max-w-md"
            />

            <div class={TILE_GRID}>
              <For each={fed()}>{(item) => <ItemTile item={item} />}</For>
            </div>
          </div>
        )}
      </Show>
    </>
  );
};
