import { createSignal, onCleanup } from "solid-js";

import { clear } from "../../core/items/preview.ts";

const THRESHOLD = 4;
const EDGE = 48;
const MAX_SCROLL = 24;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Placed {
  index: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DragSelect {
  /** Item indexes under the rectangle, while dragging */
  dragged: () => ReadonlySet<string> | undefined;
  additive: () => boolean;
  /** The rectangle in viewport coordinates */
  box: () => Box | undefined;
  onPointerDown: (event: PointerEvent) => void;
}

/** Rectangle selection over the `[data-item-index]` tiles inside a container */
export const createDragSelect = (
  container: () => HTMLElement | undefined,
  onCommit: (indexes: string[], additive: boolean) => void,
): DragSelect => {
  const [dragged, setDragged] = createSignal<ReadonlySet<string> | undefined>(
    undefined,
  );
  const [additive, setAdditive] = createSignal(false);
  const [box, setBox] = createSignal<Box | undefined>(undefined);

  let startX = 0;
  let startY = 0;
  let clientX = 0;
  let clientY = 0;
  let started = false;
  let placed: Placed[] = [];
  let frame: number | undefined = undefined;

  const update = () => {
    const x = clientX + window.scrollX;
    const y = clientY + window.scrollY;
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const right = Math.max(startX, x);
    const bottom = Math.max(startY, y);

    setBox({
      left: left - window.scrollX,
      top: top - window.scrollY,
      width: right - left,
      height: bottom - top,
    });

    setDragged(
      new Set(
        placed.flatMap((one) =>
          one.left < right &&
          one.right > left &&
          one.top < bottom &&
          one.bottom > top
            ? [one.index]
            : [],
        ),
      ),
    );
  };

  const scroll = () => {
    const ceiling =
      document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    let speed = 0;

    if (clientY < ceiling + EDGE) {
      speed = -Math.min(MAX_SCROLL, ceiling + EDGE - clientY);
    } else if (clientY > window.innerHeight - EDGE) {
      speed = Math.min(MAX_SCROLL, clientY - (window.innerHeight - EDGE));
    }

    if (speed !== 0) {
      window.scrollBy(0, speed);
      update();
    }

    frame = requestAnimationFrame(scroll);
  };

  const begin = () => {
    started = true;
    clear();
    window.getSelection()?.removeAllRanges();

    const root = container();

    placed = [
      ...(root?.querySelectorAll<HTMLElement>("[data-item-index]") ?? []),
    ].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const index = element.dataset.itemIndex;

      if (index === undefined || rect.width === 0) {
        return [];
      }

      return [
        {
          index,
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          right: rect.right + window.scrollX,
          bottom: rect.bottom + window.scrollY,
        },
      ];
    });

    frame = requestAnimationFrame(scroll);
  };

  const finish = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", finish);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("blur", finish);

    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }

    started = false;
    placed = [];
    setDragged(undefined);
    setBox(undefined);
  };

  // The trailing click would hit a tile or the background
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const onMove = (event: PointerEvent) => {
    clientX = event.clientX;
    clientY = event.clientY;

    if (!started) {
      const distance = Math.hypot(
        clientX + window.scrollX - startX,
        clientY + window.scrollY - startY,
      );

      if (distance < THRESHOLD) {
        return;
      }

      begin();
    }

    update();
  };

  const onUp = () => {
    if (!started) {
      finish();

      return;
    }

    const indexes = [...(dragged() ?? [])];
    const adding = additive();

    finish();
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    onCommit(indexes, adding);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && started) {
      event.stopPropagation();
      finish();
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;

    if (
      event.button !== 0 ||
      event.pointerType === "touch" ||
      target.closest(
        "button:not(.item-tile), a, input, select, textarea, label, [role=combobox]",
      )
    ) {
      return;
    }

    startX = event.clientX + window.scrollX;
    startY = event.clientY + window.scrollY;
    clientX = event.clientX;
    clientY = event.clientY;
    setAdditive(event.metaKey || event.ctrlKey || event.shiftKey);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", finish);
  };

  onCleanup(finish);

  return { dragged, additive, box, onPointerDown };
};
