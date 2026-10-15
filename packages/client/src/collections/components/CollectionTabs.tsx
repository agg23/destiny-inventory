import { Show } from "solid-js";

import { PickOne } from "../../ui/PickOne.tsx";
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
  onKind: (kind: Kind) => void;
  onGrouping: (grouping: Grouping) => void;
}) => (
  <>
    <PickOne
      value={props.kind}
      options={KINDS}
      label={(one) => KIND_LABELS[one]}
      onChange={props.onKind}
    />
    <Show when={props.kind === "weapon"}>
      <PickOne
        value={props.grouping}
        options={GROUPINGS}
        label={(one) => GROUPING_LABELS[one]}
        onChange={props.onGrouping}
      />
    </Show>
  </>
);
