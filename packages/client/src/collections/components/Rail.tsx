import { For } from "solid-js";

import type { Group, Section } from "../../collections.ts";

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
        class="menu-item"
        classList={{ active: props.picked.includes(group) }}
        onClick={() => props.onPick(group)}
      >
        {group.label}
        <span class="menu-item-note">{props.count(group)}</span>
      </button>
    </li>
  );

  return (
    <nav class="collections-rail">
      <ul class="menu-list collections-section">
        <li>
          <button
            type="button"
            class="menu-item"
            classList={{ active: props.picked.length === 0 }}
            onClick={() => props.onPick(undefined)}
          >
            All
            <span class="menu-item-note">{props.allCount}</span>
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
          <div class="collections-section">
            <h4 class="section-label mb-2">{section.label}</h4>
            <ul class="menu-list">
              <For each={section.groups}>{item}</For>
            </ul>
          </div>
        )}
      </For>
    </nav>
  );
};
