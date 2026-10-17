import { Show } from "solid-js";

import { PickOne } from "../../components/lib/PickOne.tsx";
import { Select } from "../../components/lib/Select.tsx";
import {
  CATALYST_LABELS,
  STATUS_LABELS,
} from "../../core/collections/labels.ts";
import {
  CATALYSTS,
  CLASSES,
  RARITIES,
  STATUSES,
  termValue,
  type ClassName,
} from "../../core/collections/terms.ts";
import { LAYOUTS, type Kind, type Layout } from "../../core/url.ts";

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

export const CLASS_LABELS: Record<ClassName, string> = {
  titan: "Titan",
  hunter: "Hunter",
  warlock: "Warlock",
};

/** Toolbar dropdowns bound to their query terms */
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
      <Select
        label="Class"
        options={CLASSES}
        names={CLASS_LABELS}
        value={props.className}
        onChange={(value) => props.onTerm("is", CLASSES, value)}
      />
    </Show>
    <Select
      label="Rarity"
      options={RARITIES}
      names={RARITY_LABELS}
      value={termValue(props.query, "is", RARITIES)}
      all
      onChange={(value) => props.onTerm("is", RARITIES, value)}
    />
    <Select
      label="Status"
      options={STATUSES}
      names={STATUS_LABELS}
      value={termValue(props.query, "status", STATUSES)}
      all
      onChange={(value) => props.onTerm("status", STATUSES, value)}
    />
    <Show when={props.kind === "weapon"}>
      <Select
        label="Catalyst"
        options={CATALYSTS}
        names={CATALYST_LABELS}
        value={termValue(props.query, "catalyst", CATALYSTS)}
        all
        onChange={(value) => props.onTerm("catalyst", CATALYSTS, value)}
      />
    </Show>
    <PickOne
      value={props.layout}
      options={LAYOUTS}
      label={(one) => LAYOUT_LABELS[one]}
      onChange={props.onLayout}
    />
  </>
);
