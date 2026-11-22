import { createEffect, createRoot, createSignal } from "solid-js";

import { LOOK_SLOTS, type LookSlot } from "@dvm/defs-core";
import type { LookPiece } from "@dvm/service";

import type { SlotStatus } from "../../core/looks/armorSet.ts";
import { readStored, writeStored } from "../../core/storage.ts";

export type Pieces = Record<LookSlot, LookPiece>;

export const SLOT_LABELS: Record<LookSlot, string> = {
  helmet: "Helmet",
  arms: "Arms",
  chest: "Chest",
  legs: "Legs",
  class: "Class item",
};

export const PICK_KINDS = ["armor", "ornament", "shader"] as const;

export type PickKind = (typeof PICK_KINDS)[number];

export interface Picking {
  slot: LookSlot;
  kind: PickKind;
}

export interface Editing {
  id: string;
  name: string;
}

export const EMPTY_PIECE: LookPiece = {
  armorHash: undefined,
  ornamentHash: undefined,
  shaderHash: undefined,
};

const DESIGN_KEY = "dvm.looks.design";

interface Design {
  classType: number;
  female: boolean;
  piecesByClass: Partial<Record<number, Pieces>>;
  editing: Editing | undefined;
}

const stored = (readStored(DESIGN_KEY) ?? {}) as Partial<Design>;

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

export const [picking, setPicking] = createSignal<Picking>({
  slot: "helmet",
  kind: "armor",
});

export const [ownedOnly, setOwnedOnly] = createSignal(false);

/** The saved look these pieces came from */
export const [editing, setEditing] = createSignal<Editing | undefined>(
  typeof stored.editing?.id === "string" ? stored.editing : undefined,
);

createRoot(() =>
  createEffect(() => {
    const design: Design = {
      classType: classType(),
      female: female(),
      piecesByClass: piecesByClass(),
      editing: editing(),
    };

    writeStored(DESIGN_KEY, design);
  }),
);

export const NOTHING_SHOWN = Object.fromEntries(
  LOOK_SLOTS.map((slot) => [slot, { kind: "loading" }]),
) as Record<LookSlot, SlotStatus>;

/** What the viewer has on screen for each slot */
export const [slotStatus, setSlotStatus] =
  createSignal<Record<LookSlot, SlotStatus>>(NOTHING_SHOWN);
