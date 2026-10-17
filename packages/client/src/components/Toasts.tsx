import { For } from "solid-js";

import { dismiss, toasts } from "../core/toast.ts";

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
