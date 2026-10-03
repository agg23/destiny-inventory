import { For, Show } from "solid-js";

import { TabButton } from "../../ui/TabButton.tsx";
import { GROUPINGS, KINDS, type Grouping, type Kind } from "../../url.ts";

const KIND_LABELS: Record<Kind, string> = {
  weapon: "Weapons",
  armor: "Armor",
};

const GROUPING_LABELS: Record<Grouping, string> = {
  type: "By type",
  source: "By source",
};

export const CollectionTabs = (props: {
  kind: Kind;
  grouping: Grouping;
  total: string;
  onKind: (kind: Kind) => void;
  onGrouping: (grouping: Grouping) => void;
}) => (
  <div class="header-tabs-line">
    <nav class="nav-subtabs">
      <For each={KINDS}>
        {(one) => (
          <TabButton
            active={props.kind === one}
            onClick={() => props.onKind(one)}
          >
            {KIND_LABELS[one]}
          </TabButton>
        )}
      </For>
    </nav>
    <Show when={props.kind === "weapon"}>
      <nav class="nav-subtabs">
        <For each={GROUPINGS}>
          {(one) => (
            <TabButton
              active={props.grouping === one}
              onClick={() => props.onGrouping(one)}
            >
              {GROUPING_LABELS[one]}
            </TabButton>
          )}
        </For>
      </nav>
    </Show>
    <span class="text-sm text-dim tabular-nums">{props.total}</span>
  </div>
);
