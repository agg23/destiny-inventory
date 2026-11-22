import { createEffect, For, on, onCleanup, onMount, Show } from "solid-js";
import { AnimationMixer, type AnimationAction } from "three";

import { LOOK_SLOTS } from "@dvm/defs-core";

import { IconButton } from "../../components/lib/IconButton.tsx";
import { Select } from "../../components/lib/Select.tsx";
import { Button } from "../../components/lib/zaidan/button.tsx";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "../../components/lib/zaidan/icons.tsx";
import { messageOf } from "../../core/error.ts";
import { fetchLookAsset } from "../../core/looks/lookData.ts";
import { ModelSet, type ShownPiece } from "../../core/looks/modelSet.ts";
import {
  FEATURED_POSE_IDS,
  OTHER_POSE_IDS,
  POSE_IDS,
  POSE_NAMES,
  SHOW_ALL_POSES,
  STANDING,
} from "../../core/looks/poses.ts";
import { createLookScene } from "../../core/looks/scene.ts";
import { showToast } from "../../core/toast.ts";
import type { LookMode } from "../../core/url.ts";
import {
  pose,
  posePlaying,
  setPose,
  setPoseLoading,
  setPosePlaying,
  setSlotStatus,
  SLOT_LABELS,
  slotStatus,
  WEAPON,
  type PickSlot,
} from "./lookState.ts";

const report = (e: unknown) => showToast(messageOf(e), "danger");

const count = (slots: string[]): string =>
  slots.length === 1 ? slots[0]! : `${slots.length} pieces`;

export const Viewer = (props: {
  mode: LookMode;
  pieces: ShownPiece[];
  female: boolean;
}) => {
  let canvas!: HTMLCanvasElement;
  let set: ModelSet | undefined = undefined;

  const show = () => {
    set?.show(props.pieces, props.female).catch(report);
  };

  const failed = () =>
    Object.keys(slotStatus()).filter(
      (slot) => slotStatus()[slot]!.kind === "failed",
    ) as PickSlot[];

  const step = (delta: number) => {
    const total = POSE_IDS.length;
    const index = POSE_IDS.indexOf(pose());

    setPose(POSE_IDS[(index + delta + total) % total]!);
  };

  onMount(() => {
    const armor = props.mode === "armor";
    const view = createLookScene(canvas);
    let framed: number | undefined = undefined;
    const created = new ModelSet({
      slots: armor ? LOOK_SLOTS : [WEAPON],
      rigged: armor,
      fetchAsset: fetchLookAsset,
      compile: view.compile,
      onStatus: (slot, status) => {
        setSlotStatus((held) => ({ ...held, [slot]: status }));

        const shown = props.pieces[0]?.itemHash;

        if (!armor && status.kind === "ready" && shown !== framed) {
          framed = shown;
          view.frame(created.group);
        }

        view.invalidate();
      },
    });

    set = created;
    view.scene.add(created.group);

    createEffect(show);

    if (armor) {
      const mixer = new AnimationMixer(created.group);
      let action: AnimationAction | undefined = undefined;
      let request = 0;

      const tick = () =>
        view.setTicker(
          action && posePlaying()
            ? (seconds) => mixer.update(seconds)
            : undefined,
        );

      createEffect(
        on(pose, async (file) => {
          request += 1;

          const mine = request;

          if (file === STANDING) {
            mixer.stopAllAction();
            action = undefined;
            created.stand();
            setPoseLoading(false);
            tick();

            return;
          }

          // Stopping an action restores the rest pose
          if (action) {
            action.paused = true;
          }

          view.setTicker(undefined);
          setPoseLoading(true);

          try {
            const clip = await created.animation(file);

            if (mine !== request) {
              return;
            }

            mixer.stopAllAction();
            action = mixer.clipAction(clip);
            action.play();

            // The ends of an emote are a neutral stance
            if (!posePlaying()) {
              action.time = clip.duration / 2;
              action.paused = true;
            }

            mixer.update(0);
          } catch (e) {
            report(e);
          }

          if (mine === request) {
            setPoseLoading(false);
            tick();
          }
        }),
      );

      createEffect(
        on(
          posePlaying,
          (playing) => {
            if (action) {
              action.paused = !playing;
            }

            tick();
          },
          { defer: true },
        ),
      );
    }

    onCleanup(() => {
      set = undefined;
      setSlotStatus({});
      setPoseLoading(false);
      created.dispose();
      view.dispose();
    });
  });

  return (
    <div class="relative size-full">
      <canvas ref={canvas} class="size-full touch-none" />
      <Show when={props.mode === "armor"}>
        <div class="absolute inset-x-0 top-0 flex justify-center">
          <div class="flex items-center gap-0.5 rounded-md bg-card/80 p-0.5">
            <Select
              label="Pose"
              size="sm"
              class="px-1 text-sm"
              value={pose()}
              options={FEATURED_POSE_IDS}
              names={POSE_NAMES}
              onChange={setPose}
            >
              <Show when={SHOW_ALL_POSES}>
                <optgroup label="More">
                  <For each={OTHER_POSE_IDS}>
                    {(id) => <option value={id}>{POSE_NAMES[id]}</option>}
                  </For>
                </optgroup>
              </Show>
            </Select>
            <IconButton
              size="icon-sm"
              label="Previous pose"
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton size="icon-sm" label="Next pose" onClick={() => step(1)}>
              <ChevronRight />
            </IconButton>
            <IconButton
              size="icon-sm"
              label={posePlaying() ? "Pause" : "Play"}
              disabled={pose() === STANDING}
              onClick={() => setPosePlaying(!posePlaying())}
            >
              <Show when={posePlaying()} fallback={<Play />}>
                <Pause />
              </Show>
            </IconButton>
          </div>
        </div>
      </Show>
      <div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <Show when={failed().length > 0}>
          <div
            class="pointer-events-auto flex items-center gap-3 rounded-md bg-card px-3 py-2 ring-1 ring-destructive/40"
            title={failed()
              .map((slot) => {
                const status = slotStatus()[slot]!;

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
