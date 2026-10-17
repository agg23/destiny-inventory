import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import {
  setOnlyTagMany,
  snapshotTags,
  tagTarget,
  writeTags,
  type TagSnapshot,
} from "../../core/items/tags.ts";

interface Write {
  targets: DimItem[];
  tagId: string | undefined;
}

interface Pending {
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

/** Tag writes with their confirm and one level of undo */
export const createWrites = (): Writes => {
  const [pending, setPending] = createSignal<Pending | undefined>(undefined);
  const [undone, setUndone] = createSignal<Undone | undefined>(undefined);

  const apply = (writes: Write[], label: string) => {
    setUndone({
      label,
      snapshot: snapshotTags(
        writes.flatMap((one) => one.targets.map(tagTarget)),
      ),
    });

    for (const one of writes) {
      setOnlyTagMany(one.targets.map(tagTarget), one.tagId);
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

    writeTags(held.snapshot);
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
