import { Show } from "solid-js";

import {
  CATALYSTS,
  CLASSES,
  RARITIES,
  STATUSES,
  termValue,
  type ClassName,
} from "../../collections.ts";
import { LAYOUTS, type Kind, type Layout } from "../../url.ts";
import { Choice } from "./Choice.tsx";

const LAYOUT_LABELS: Record<Layout, string> = {
  grid: "Grid",
  list: "List",
};

const RARITY_LABELS: Record<(typeof RARITIES)[number], string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
  exotic: "Exotic",
};

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  owned: "Owned",
  unlocked: "Unlocked",
  neverseen: "Never seen",
};

const CATALYST_LABELS: Record<(typeof CATALYSTS)[number], string> = {
  missing: "Missing",
  obtained: "Obtained",
  complete: "Complete",
};

export const CLASS_LABELS: Record<ClassName, string> = {
  titan: "Titan",
  hunter: "Hunter",
  warlock: "Warlock",
};

/** The toolbar dropdowns, each reading and writing its term in the query */
export const Filters = (props: {
  kind: Kind;
  query: string;
  className: ClassName;
  layout: Layout;
  onTerm: (
    key: string,
    values: readonly string[],
    value: string | undefined,
  ) => void;
  onLayout: (layout: Layout) => void;
}) => (
  <>
    <Show when={props.kind === "armor"}>
      <Choice
        label="Class"
        options={CLASSES}
        labels={CLASS_LABELS}
        value={props.className}
        all={false}
        onChoose={(value) => props.onTerm("is", CLASSES, value)}
      />
    </Show>
    <Choice
      label="Rarity"
      options={RARITIES}
      labels={RARITY_LABELS}
      value={termValue(props.query, "is", RARITIES)}
      onChoose={(value) => props.onTerm("is", RARITIES, value)}
    />
    <Choice
      label="Status"
      options={STATUSES}
      labels={STATUS_LABELS}
      value={termValue(props.query, "status", STATUSES)}
      onChoose={(value) => props.onTerm("status", STATUSES, value)}
    />
    <Show when={props.kind === "weapon"}>
      <Choice
        label="Catalyst"
        options={CATALYSTS}
        labels={CATALYST_LABELS}
        value={termValue(props.query, "catalyst", CATALYSTS)}
        onChoose={(value) => props.onTerm("catalyst", CATALYSTS, value)}
      />
    </Show>
    <Choice
      label="View"
      options={LAYOUTS}
      labels={LAYOUT_LABELS}
      value={props.layout}
      all={false}
      onChoose={(layout) => {
        if (layout) {
          props.onLayout(layout);
        }
      }}
    />
  </>
);
