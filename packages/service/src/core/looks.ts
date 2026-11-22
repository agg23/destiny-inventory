import { LOOK_SLOTS, type LookSlot } from "@dvm/defs-core";

// Rows are never deleted. A removal is the flag plus a fresh timestamp

export const MAX_LOOK_NAME_LENGTH = 100;

export interface LookPiece {
  armorHash: number | undefined;
  ornamentHash: number | undefined;
  shaderHash: number | undefined;
}

export interface Look {
  /** Minted by the client */
  id: string;
  name: string;
  classType: number;
  female: boolean;
  pieces: Record<LookSlot, LookPiece>;
  removed: boolean;
  updatedAt: number;
}

export type LookChange = Omit<Look, "updatedAt">;

export interface LookStore {
  read: (membershipId: string, since: number) => Promise<Look[]>;
  write: (
    membershipId: string,
    change: LookChange,
    now: number,
  ) => Promise<void>;
}

const hashOf = (raw: unknown): number | undefined | false => {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0
    ? raw
    : false;
};

const pieceOf = (raw: unknown): LookPiece | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const { armorHash, ornamentHash, shaderHash } = raw as Record<
    string,
    unknown
  >;
  const piece = {
    armorHash: hashOf(armorHash),
    ornamentHash: hashOf(ornamentHash),
    shaderHash: hashOf(shaderHash),
  };

  if (
    piece.armorHash === false ||
    piece.ornamentHash === false ||
    piece.shaderHash === false
  ) {
    return undefined;
  }

  return piece as LookPiece;
};

/** Undefined when the body is not one well formed look */
export const parseLook = (raw: unknown): LookChange | undefined => {
  const { id, name, classType, female, pieces, removed } = (raw ??
    {}) as Record<string, unknown>;

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 64 ||
    typeof name !== "string" ||
    name.length > MAX_LOOK_NAME_LENGTH ||
    typeof classType !== "number" ||
    ![0, 1, 2].includes(classType) ||
    typeof female !== "boolean"
  ) {
    return undefined;
  }

  const parsed: Partial<Record<LookSlot, LookPiece>> = {};

  for (const slot of LOOK_SLOTS) {
    const piece = pieceOf(
      (pieces as Record<string, unknown> | undefined)?.[slot],
    );

    if (!piece) {
      return undefined;
    }

    parsed[slot] = piece;
  }

  return {
    id,
    name: name.trim(),
    classType,
    female,
    pieces: parsed as Record<LookSlot, LookPiece>,
    removed: !!removed,
  };
};
