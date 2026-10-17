import { createSignal, Show } from "solid-js";

import { beginLogin } from "../core/api/auth.ts";
import { messageOf } from "../core/error.ts";
import { Button } from "./lib/zaidan/button.tsx";

export const SignIn = () => {
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);

  return (
    <div class="flex max-w-[420px] flex-col items-start gap-3 px-6 py-12">
      <h1 class="text-2xl font-semibold">Vault</h1>
      <p class="text-muted-foreground">
        Sign in with your Bungie account to load your inventory.
      </p>
      <Button
        size="lg"
        onClick={() => {
          setAuthError(undefined);
          beginLogin().catch((e: unknown) => setAuthError(messageOf(e)));
        }}
      >
        Sign in with Bungie
      </Button>
      <Show when={authError()}>
        {(message) => <p class="text-destructive">{message()}</p>}
      </Show>
    </div>
  );
};
