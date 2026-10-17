import { createSignal } from "solid-js";

const DURATION = 5_000;

interface Toast {
  id: number;
  message: string;
  kind: "info" | "danger";
}

const [shown, setToasts] = createSignal<Toast[]>([]);

let nextId = 0;

export const toasts = shown;

export const dismiss = (id: number) => {
  setToasts((was) => was.filter((one) => one.id !== id));
};

/** Queues a toast that dismisses itself after a few seconds, or on click */
export const showToast = (message: string, kind: Toast["kind"] = "info") => {
  nextId += 1;

  const id = nextId;

  setToasts((was) => [...was, { id, message, kind }]);
  window.setTimeout(() => dismiss(id), DURATION);
};
