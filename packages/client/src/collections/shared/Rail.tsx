import { For } from "solid-js";

import { LABEL, ROW } from "../../components/lib/text.ts";
import type { Group, Section } from "../../core/collections/types.ts";

const LIST = "flex flex-col";

const NOTE = "shrink-0 text-xs text-muted-foreground tabular-nums";

export const Rail = (props: {
  sections: Section[];
  picked: Group[];
  allCount: string;
  count: (group: Group) => string;
  onPick: (group: Group | undefined) => void;
}) => {
  const item = (group: Group) => (
    <li>
      <button
        type="button"
        class={ROW}
        classList={{ "bg-muted": props.picked.includes(group) }}
        onClick={() => props.onPick(group)}
      >
        <span class="min-w-0 flex-1 truncate">{group.label}</span>
        <span class={NOTE}>{props.count(group)}</span>
      </button>
    </li>
  );

  return (
    <nav class="sticky top-[calc(var(--header-h,49px)+1rem)] flex max-h-[calc(100vh-var(--header-h,49px)-2rem)] flex-col gap-3 overflow-y-auto">
      <ul class={LIST}>
        <li>
          <button
            type="button"
            class={ROW}
            classList={{ "bg-muted": props.picked.length === 0 }}
            onClick={() => props.onPick(undefined)}
          >
            <span class="flex-1">All</span>
            <span class={NOTE}>{props.allCount}</span>
          </button>
        </li>
        <For
          each={props.sections
            .filter((section) => section.label === "")
            .flatMap((section) => section.groups)}
        >
          {item}
        </For>
      </ul>
      <For each={props.sections.filter((section) => section.label !== "")}>
        {(section) => (
          <div class="flex flex-col gap-1">
            <h4 class={`${LABEL} px-1.5`}>{section.label}</h4>
            <ul class={LIST}>
              <For each={section.groups}>{item}</For>
            </ul>
          </div>
        )}
      </For>
    </nav>
  );
};
