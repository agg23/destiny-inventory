import { For, Show } from "solid-js";

import { timeWithSeconds } from "../../core/time.ts";

interface Props {
  failingSince: number | undefined;
  refreshedAt: number | undefined;
  syncError: string | undefined;
  guestError: Error | undefined;
}

export const HeaderStatus = (props: Props) => (
  <Show
    when={
      props.failingSince !== undefined ||
      props.syncError !== undefined ||
      props.guestError !== undefined
    }
  >
    <span class="flex min-w-0 shrink items-center gap-3 truncate">
      <Show when={props.failingSince}>
        {(since) => (
          <span class="truncate text-warning">
            Refresh failing since {timeWithSeconds(since())}
            <Show when={props.refreshedAt}>
              {(at) => <> · data from {timeWithSeconds(at())}</>}
            </Show>
          </span>
        )}
      </Show>

      <For
        each={[
          ...(props.syncError ? [props.syncError] : []),
          ...(props.guestError ? [props.guestError.message] : []),
        ]}
      >
        {(message) => (
          <span class="truncate text-destructive" title={message}>
            {message}
          </span>
        )}
      </For>
    </span>
  </Show>
);
