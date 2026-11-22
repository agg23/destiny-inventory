import { createEffect, onCleanup, onMount, Show } from "solid-js";

import { LOOK_SLOTS } from "@dvm/defs-core";

import { Button } from "../../components/lib/zaidan/button.tsx";
import { messageOf } from "../../core/error.ts";
import { ArmorSet, type ShownPiece } from "../../core/looks/armorSet.ts";
import { fetchLookAsset } from "../../core/looks/lookData.ts";
import { createLookScene } from "../../core/looks/scene.ts";
import { showToast } from "../../core/toast.ts";
import {
  NOTHING_SHOWN,
  setSlotStatus,
  SLOT_LABELS,
  slotStatus,
} from "./lookState.ts";

const report = (e: unknown) => showToast(messageOf(e), "danger");

const count = (slots: string[]): string =>
  slots.length === 1 ? slots[0]! : `${slots.length} pieces`;

export const Viewer = (props: { pieces: ShownPiece[]; female: boolean }) => {
  let canvas!: HTMLCanvasElement;
  let set: ArmorSet | undefined = undefined;

  const show = () => {
    set?.show(props.pieces, props.female).catch(report);
  };

  const failed = () =>
    LOOK_SLOTS.filter((slot) => slotStatus()[slot].kind === "failed");

  onMount(() => {
    const view = createLookScene(canvas);
    const created = new ArmorSet({
      fetchAsset: fetchLookAsset,
      compile: view.compile,
      onStatus: (slot, status) => {
        setSlotStatus((held) => ({ ...held, [slot]: status }));
        view.invalidate();
      },
    });

    set = created;
    view.scene.add(created.group);

    createEffect(show);

    onCleanup(() => {
      set = undefined;
      setSlotStatus(NOTHING_SHOWN);
      created.dispose();
      view.dispose();
    });
  });

  return (
    <div class="relative size-full">
      <canvas ref={canvas} class="size-full touch-none" />
      <div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <Show when={failed().length > 0}>
          <div
            class="pointer-events-auto flex items-center gap-3 rounded-md bg-card px-3 py-2 ring-1 ring-destructive/40"
            title={failed()
              .map((slot) => {
                const status = slotStatus()[slot];

                return status.kind === "failed"
                  ? `${SLOT_LABELS[slot]}: ${status.message}`
                  : "";
              })
              .join("\n")}
          >
            <span class="text-destructive">
              {count(failed().map((slot) => SLOT_LABELS[slot]))} didn't load
            </span>
            <Button variant="outline" size="xs" onClick={show}>
              Retry
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
};
