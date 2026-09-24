import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import {
  restoreTags,
  setOnlyTagMany,
  snapshotTags,
  type TagSnapshot,
} from "../tags.ts";

export interface Write {
  targets: DimItem[];
  tagId: string | undefined;
}

export interface Pending {
  label: string;
  note: string | undefined;
  writes: Write[];
}

interface Undone {
  label: string;
  snapshot: TagSnapshot[];
}

export interface Writes {
  pending: () => Pending | undefined;
  undone: () => Undone | undefined;
  ask: (next: Pending) => void;
  cancel: () => void;
  apply: (writes: Write[], label: string) => void;
  commit: () => void;
  undo: () => void;
}

const entriesOf = (targets: DimItem[]) =>
  targets.map((item) => ({ instanceId: item.id, itemHash: item.hash }));

/** Tag writes, the confirm they wait behind, and the one level of undo behind them */
export const createWrites = (): Writes => {
  const [pending, setPending] = createSignal<Pending | undefined>(undefined);
  const [undone, setUndone] = createSignal<Undone | undefined>(undefined);

  const apply = (writes: Write[], label: string) => {
    setUndone({
      label,
      snapshot: snapshotTags(writes.flatMap((one) => entriesOf(one.targets))),
    });

    for (const one of writes) {
      setOnlyTagMany(entriesOf(one.targets), one.tagId);
    }
  };

  const commit = () => {
    const held = pending();

    if (!held) {
      return;
    }

    apply(held.writes, held.label);
    setPending(undefined);
  };

  const undo = () => {
    const held = undone();

    if (!held) {
      return;
    }

    restoreTags(held.snapshot);
    setUndone(undefined);
  };

  return {
    pending,
    undone,
    ask: (next) => setPending(next),
    cancel: () => setPending(undefined),
    apply,
    commit,
    undo,
  };
};
