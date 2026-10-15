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
  <div class="pointer-events-none fixed bottom-10 left-1/2 z-60 flex -translate-x-1/2 flex-col items-center gap-2">
    <For each={toasts()}>
      {(toast) => (
        <button
          type="button"
          class="pointer-events-auto max-w-[min(36rem,calc(100dvw-2rem))] animate-toast-in rounded-lg border bg-popover px-4 py-3 text-center shadow-lg"
          classList={{
            "border-destructive/50 text-destructive": toast.kind === "danger",
          }}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      )}
    </For>
  </div>
);
