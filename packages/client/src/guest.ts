import { createSignal } from "solid-js";

import type { Membership } from "./bungie.ts";

const KEY = "dvm.guests";

const LIMIT = 8;

// URLSearchParams leaves only * - . _ unescaped
const SEPARATOR = "_";

export interface Guest {
  membershipType: number;
  membershipId: string;
  name: string;
  code: number | undefined;
  pinned: boolean;
}

const [held, setHeld] = createSignal<Membership | undefined>(undefined);

/** The account being shown, when it is not the signed-in one */
export const guest = held;

export const setGuest = setHeld;

export const guestParam = (who: Membership): string =>
  `${who.membershipType}${SEPARATOR}${who.membershipId}`;

export const readGuestParam = (
  raw: string | undefined,
): Membership | undefined => {
  const [type, membershipId] = (raw ?? "").split(SEPARATOR);
  const membershipType = Number(type);

  if (!membershipId || !Number.isInteger(membershipType)) {
    return undefined;
  }

  return { membershipType, membershipId };
};

export const sameMembership = (
  one: Membership | undefined,
  two: Membership | undefined,
): boolean =>
  one?.membershipId === two?.membershipId &&
  one?.membershipType === two?.membershipType;

/** Bungie name with its four digit code, which is what people recognize */
export const guestLabel = (who: Guest): string =>
  who.code === undefined
    ? who.name
    : `${who.name}#${who.code.toString().padStart(4, "0")}`;

const read = (): Guest[] => {
  const raw = localStorage.getItem(KEY);

  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is Guest =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Guest).membershipId === "string",
        )
      : [];
  } catch {
    return [];
  }
};

const write = (kept: Guest[]): Guest[] => {
  const trimmed = [
    ...kept.filter((entry) => entry.pinned),
    ...kept.filter((entry) => !entry.pinned).slice(0, LIMIT),
  ];

  localStorage.setItem(KEY, JSON.stringify(trimmed));

  return trimmed;
};

/** Pinned first, then the people looked up most recently */
export const rememberedGuests = (): Guest[] => {
  const held = read();

  return [
    ...held.filter((entry) => entry.pinned),
    ...held.filter((entry) => !entry.pinned),
  ];
};

export const rememberGuest = (who: Guest): Guest[] => {
  const held = read();
  const was = held.find((entry) => sameMembership(entry, who));

  return write([
    { ...who, pinned: who.pinned || Boolean(was?.pinned) },
    ...held.filter((entry) => !sameMembership(entry, who)),
  ]);
};

export const pinGuest = (who: Membership, pinned: boolean): Guest[] =>
  write(
    read().map((entry) =>
      sameMembership(entry, who) ? { ...entry, pinned } : entry,
    ),
  );

export const forgetGuest = (who: Membership): Guest[] =>
  write(read().filter((entry) => !sameMembership(entry, who)));
