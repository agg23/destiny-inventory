import { createSignal, For } from "solid-js";

const DURATION = 5_000;

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "danger";
}

const [toasts, setToasts] = createSignal<Toast[]>([]);

let nextId = 0;

const dismiss = (id: number) => {
  setToasts((was) => was.filter((one) => one.id !== id));
};

/** Queues a toast that dismisses itself after a few seconds, or on click */
export const showToast = (message: string, kind: Toast["kind"] = "info") => {
  nextId += 1;

  const id = nextId;

  setToasts((was) => [...was, { id, message, kind }]);
  window.setTimeout(() => dismiss(id), DURATION);
};

export const Toasts = () => (
  <div class="toast-stack">
    <For each={toasts()}>
      {(toast) => (
        <button
          type="button"
          class="toast"
          classList={{ danger: toast.kind === "danger" }}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      )}
    </For>
  </div>
);
