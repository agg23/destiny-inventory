import { A } from "@solidjs/router";
import { For, Show } from "solid-js";

import { tabHref, TABS, type Tab } from "../../core/url.ts";

const LABELS: Record<Tab, string> = {
  vault: "Vault",
  triage: "Triage",
  collections: "Collections",
  activities: "Activities",
  todo: "Todo",
  history: "History",
  stats: "Stats",
};

const PAGE_LINK = "inline-flex h-7 items-center rounded-md px-2.5";

export const PageNav = (props: { tab: Tab; guest: boolean }) => (
  <nav class="flex shrink-0 items-center gap-1">
    <For each={TABS}>
      {(one) => (
        <Show
          when={one !== "todo" || !props.guest}
          fallback={
            <span
              class={`${PAGE_LINK} cursor-default text-muted-foreground opacity-50`}
              aria-disabled="true"
            >
              {LABELS[one]}
            </span>
          }
        >
          <A
            href={tabHref(one)}
            class={PAGE_LINK}
            classList={{
              "bg-muted text-foreground": props.tab === one,
              "text-muted-foreground hover:bg-muted/60 hover:text-foreground":
                props.tab !== one,
            }}
          >
            {LABELS[one]}
          </A>
        </Show>
      )}
    </For>
  </nav>
);
