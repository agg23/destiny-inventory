import { Group, Matrix4, type AnimationClip, type Object3D } from "three";
import {
  TGXMLoader,
  type GuardianSkeleton,
  type TGXModelContainer,
} from "tgxm-loader";

import type { LookAsset } from "@dvm/defs-core";

import { messageOf } from "../error.ts";

const TRANSPARENT_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export type SlotStatus =
  { kind: "ready" } | { kind: "loading" } | { kind: "failed"; message: string };

export interface ShownPiece {
  slot: string;
  itemHash: number | undefined;
  shaderHash: number | undefined;
}

interface SlotState {
  itemHash: number | undefined;
  shaderHash: number | undefined;
  container: TGXModelContainer | undefined;
  failed: string | undefined;
}

export interface ModelSetOptions {
  slots: readonly string[];
  /** Binds armor to the D1 player skeleton so it can pose */
  rigged: boolean;
  fetchAsset: (hash: number) => Promise<LookAsset>;
  compile: (object: Object3D) => Promise<unknown>;
  onStatus: (slot: string, status: SlotStatus) => void;
}

// The real lookup is a game file. Iridescent dyes lose their sheen
const placeholderIridescence = (): string => {
  const canvas = document.createElement("canvas");

  canvas.width = 64;
  canvas.height = 128;

  const context = canvas.getContext("2d")!;

  context.fillStyle = "#000";
  context.fillRect(0, 0, 64, 128);

  return canvas.toDataURL("image/png");
};

// The loader logs a few hundred lines per piece
const quietly = async <T>(task: () => Promise<T>): Promise<T> => {
  const { log, debug, time, timeEnd } = console;

  console.log = () => {};
  console.debug = () => {};
  console.time = () => {};
  console.timeEnd = () => {};

  try {
    return await task();
  } finally {
    console.log = log;
    console.debug = debug;
    console.time = time;
    console.timeEnd = timeEnd;
  }
};

/** One item and shader per slot, rendered into group */
export class ModelSet {
  readonly group = new Group();

  private readonly loader: TGXMLoader;
  private readonly options: ModelSetOptions;
  private readonly slots: Map<string, SlotState>;
  private queue: Promise<void> = Promise.resolve();
  private wanted: symbol | undefined = undefined;
  private female = false;
  private disposed = false;
  private skeleton: GuardianSkeleton | undefined = undefined;
  private rest: Matrix4[] = [];

  constructor(options: ModelSetOptions) {
    this.options = options;
    this.slots = new Map(
      options.slots.map((slot) => [
        slot,
        {
          itemHash: undefined,
          shaderHash: undefined,
          container: undefined,
          failed: undefined,
        },
      ]),
    );
    this.loader = new TGXMLoader({
      Destiny2InventoryDefinition: {
        source: "asyncHandler",
        asyncHandler: async (hash) =>
          (await options.fetchAsset(Number(hash))).definition,
      },
      Destiny2GearAssetDefinition: {
        source: "asyncHandler",
        asyncHandler: async (hash) =>
          (await options.fetchAsset(Number(hash))).gearAsset,
      },
      shaders: { source: "api" },
      iridescenceLookupPath: placeholderIridescence(),
      // Destiny 1 only, but the constructor loads them regardless
      specularTintPath: TRANSPARENT_PX,
      specularLobePath: TRANSPARENT_PX,
      cubemapPaths: Array<string>(6).fill(TRANSPARENT_PX),
      X_API_KEY: "unused",
    });
  }

  // The loader isn't safe to call concurrently
  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(() => {
      if (this.disposed) {
        return;
      }

      return quietly(task);
    });

    this.queue = run.catch(() => {});

    return run;
  }

  private async rig(): Promise<GuardianSkeleton> {
    if (!this.skeleton) {
      this.skeleton = await this.loader.loadSkeleton("guardian");
      this.rest = this.skeleton.skeleton.bones.map((bone) =>
        bone.matrix.clone(),
      );
      this.group.add(this.skeleton.rootBone);
    }

    return this.skeleton;
  }

  /** Puts every bone back where the skeleton file has it */
  stand() {
    const bones = this.skeleton?.skeleton.bones ?? [];

    for (const [index, bone] of bones.entries()) {
      this.rest[index]!.decompose(bone.position, bone.quaternion, bone.scale);
    }
  }

  /** A D1 player animation file as a clip for this set's skeleton */
  animation(fileName: string): Promise<AnimationClip> {
    let clip: AnimationClip | undefined = undefined;

    return this.enqueue(async () => {
      const { boneNames } = await this.rig();

      clip = await this.loader.loadAnimation(fileName, fileName, boneNames);
    }).then(() => clip!);
  }

  private remove(container: TGXModelContainer | undefined) {
    if (!container) {
      return;
    }

    this.group.remove(container.groupObject);
    container.dispose();
  }

  private settled(state: SlotState): SlotStatus {
    return state.failed === undefined
      ? { kind: "ready" }
      : { kind: "failed", message: state.failed };
  }

  /** Loads every changed piece, then swaps them in together. A newer call supersedes it */
  show(pieces: ShownPiece[], female: boolean): Promise<void> {
    const token = Symbol();
    const reshape = (piece: ShownPiece, state: SlotState) =>
      state.itemHash !== piece.itemHash ||
      (female !== this.female && piece.itemHash !== undefined);
    const changed = (piece: ShownPiece, state: SlotState) =>
      reshape(piece, state) || state.shaderHash !== piece.shaderHash;

    this.wanted = token;

    for (const piece of pieces) {
      const state = this.slots.get(piece.slot)!;

      this.options.onStatus(
        piece.slot,
        changed(piece, state) ? { kind: "loading" } : this.settled(state),
      );
    }

    return this.enqueue(async () => {
      if (this.wanted !== token) {
        return;
      }

      const superseded = () => this.wanted !== token || this.disposed;
      const skeleton = this.options.rigged
        ? (await this.rig()).skeleton
        : undefined;
      const loaded = new Map<string, TGXModelContainer | undefined>();
      const failed = new Map<string, string>();
      const reshaped = new Set<string>();

      for (const piece of pieces) {
        const state = this.slots.get(piece.slot)!;

        if (!reshape(piece, state)) {
          continue;
        }

        reshaped.add(piece.slot);

        if (piece.itemHash === undefined) {
          loaded.set(piece.slot, undefined);
          continue;
        }

        try {
          const container = await this.loader.load(
            {
              itemHash: piece.itemHash,
              game: "destiny2",
              isFemale: female,
              shaderHash: piece.shaderHash,
              skeleton,
            },
            () => {},
          );

          loaded.set(piece.slot, container);
          await this.options.compile(container.groupObject);
        } catch (e) {
          failed.set(piece.slot, messageOf(e));
        }

        if (superseded()) {
          break;
        }
      }

      if (superseded()) {
        for (const container of loaded.values()) {
          this.remove(container);
        }

        return;
      }

      this.female = female;

      for (const piece of pieces) {
        const state = this.slots.get(piece.slot)!;

        if (loaded.has(piece.slot)) {
          const container = loaded.get(piece.slot);

          this.remove(state.container);

          if (container) {
            this.group.add(container.groupObject);
          }

          state.container = container;
          state.itemHash = piece.itemHash;
          state.shaderHash = piece.shaderHash;
        } else if (
          !failed.has(piece.slot) &&
          state.container &&
          state.shaderHash !== piece.shaderHash
        ) {
          try {
            await this.loader.applyShaderToModel(
              state.container,
              piece.shaderHash,
            );
            state.shaderHash = piece.shaderHash;
          } catch (e) {
            failed.set(piece.slot, messageOf(e));
          }
        }

        state.failed = failed.get(piece.slot);

        // The old piece stays up, forgetting its hash makes the next call retry
        if (state.failed !== undefined && reshaped.has(piece.slot)) {
          state.itemHash = undefined;
        }

        // A newer call already reported this slot as loading
        if (!superseded()) {
          this.options.onStatus(piece.slot, this.settled(state));
        }
      }
    });
  }

  dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const state of this.slots.values()) {
      this.remove(state.container);
    }

    this.group.removeFromParent();
    this.loader.dispose();
  }
}
