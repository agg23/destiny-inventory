import { createEffect, createRoot, createSignal } from "solid-js";

import { type LookSlot } from "@dvm/defs-core";
import type { LookPiece } from "@dvm/service";

import type { SlotStatus } from "../../core/looks/modelSet.ts";
import { STANDING } from "../../core/looks/poses.ts";
import { readStored, writeStored } from "../../core/storage.ts";
import type { LookMode } from "../../core/url.ts";

export type Pieces = Record<LookSlot, LookPiece>;

export const WEAPON = "weapon";

export type PickSlot = LookSlot | typeof WEAPON;

export const SLOT_LABELS: Record<PickSlot, string> = {
  helmet: "Helmet",
  arms: "Arms",
  chest: "Chest",
  legs: "Legs",
  class: "Class item",
  weapon: "Weapon",
};

export const PICK_KINDS = ["gear", "shader"] as const;

export type PickKind = (typeof PICK_KINDS)[number];

export interface Picking {
  slot: PickSlot;
  kind: PickKind;
}

export interface WeaponPiece {
  weaponHash: number | undefined;
  ornamentHash: number | undefined;
  shaderHash: number | undefined;
}

export const EMPTY_PIECE: LookPiece = {
  armorHash: undefined,
  ornamentHash: undefined,
  shaderHash: undefined,
};

const DESIGN_KEY = "dvm.looks.design";

interface Design {
  mode: LookMode;
  classType: number;
  female: boolean;
  piecesByClass: Partial<Record<number, Pieces>>;
  weapon: WeaponPiece;
}

const stored = (readStored(DESIGN_KEY) ?? {}) as Partial<Design>;

export const [mode, setMode] = createSignal<LookMode>(
  stored.mode === "weapons" ? "weapons" : "armor",
);

export const [classType, setClassType] = createSignal(
  typeof stored.classType === "number" ? stored.classType : 0,
);

export const [female, setFemale] = createSignal(stored.female === true);

/** Each class keeps its own pieces while switching */
export const [piecesByClass, setPiecesByClass] = createSignal<
  Partial<Record<number, Pieces>>
>(
  typeof stored.piecesByClass === "object" && stored.piecesByClass !== null
    ? stored.piecesByClass
    : {},
);

export const [weapon, setWeapon] = createSignal<WeaponPiece>(
  typeof stored.weapon === "object" && stored.weapon !== null
    ? stored.weapon
    : { weaponHash: undefined, ornamentHash: undefined, shaderHash: undefined },
);

export const [armorPicking, setArmorPicking] = createSignal<Picking>({
  slot: "helmet",
  kind: "gear",
});

export const [weaponPicking, setWeaponPicking] = createSignal<Picking>({
  slot: WEAPON,
  kind: "gear",
});

export const [ownedOnly, setOwnedOnly] = createSignal(false);

createRoot(() =>
  createEffect(() => {
    const design: Design = {
      mode: mode(),
      classType: classType(),
      female: female(),
      piecesByClass: piecesByClass(),
      weapon: weapon(),
    };

    writeStored(DESIGN_KEY, design);
  }),
);

/** STANDING, or a D1 animation file from POSES */
export const [pose, setPose] = createSignal(STANDING);

export const [posePlaying, setPosePlaying] = createSignal(false);

export const [poseLoading, setPoseLoading] = createSignal(false);

/** What the viewer has on screen for each slot, empty until it mounts */
export const [slotStatus, setSlotStatus] = createSignal<
  Record<string, SlotStatus>
>({});
