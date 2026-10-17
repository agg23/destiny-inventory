import type { DimItem } from "app/inventory/item-types";
import { createMemo, Show } from "solid-js";

import { Checkbox } from "../components/lib/Checkbox.tsx";
import { PickOne } from "../components/lib/PickOne.tsx";
import { Select } from "../components/lib/Select.tsx";
import { Rail } from "../components/rail/Rail.tsx";
import { useApp } from "../core/app/state.ts";
import { tagDefs, tagFor } from "../core/items/tags.ts";
import { useUrl } from "../core/router.ts";
import { plural } from "../core/text.ts";
import { TRIAGE_SORTS, TRIAGE_STEPS, type TriageStep } from "../core/url.ts";
import { trashRun } from "./shared/trashRun.ts";
import { feed, triageable } from "./shared/triage.ts";
import { TriageBar } from "./shared/TriageBar.tsx";
import { TriageCompare } from "./shared/TriageCompare.tsx";
import { TriageFeed } from "./shared/TriageFeed.tsx";
import { createSelection } from "./shared/triageSelection.ts";
import { TriageTrash } from "./shared/TriageTrash.tsx";
import { createWrites } from "./shared/triageWrites.ts";

const STEP_LABELS: Record<TriageStep, string> = {
  tag: "1 · Tag",
  compare: "2 · Compare",
  trash: "3 · Trash",
};

const SORT_LABELS = {
  received: "Received",
  power: "Power",
  name: "Name",
  type: "Type",
};

export const Triage = () => {
  const app = useApp();
  const url = useUrl();

  const step = () => url.get("step");

  const pool = createMemo(() =>
    app
      .stores()
      .flatMap((store) => store.items)
      .filter(triageable),
  );

  const matched = createMemo(() =>
    [...app.matched().byStore.values()].flatMap((buckets) =>
      [...buckets.values()].flat(),
    ),
  );

  const shown = createMemo(() =>
    feed(matched(), url.get("sort"), url.get("tagged")),
  );

  const writes = createWrites();
  const selection = createSelection(pool, writes.cancel);

  const onMenuTag = (item: DimItem, tagId: string | undefined) => {
    if (!selection.picked().has(item.id)) {
      writes.apply([{ targets: [item], tagId }], `Tagged ${item.name}`);

      return;
    }

    const targets = selection.items();

    writes.apply(
      [{ targets, tagId }],
      `Tagged ${plural(targets.length, "item")}`,
    );
  };

  const tagged = () =>
    pool().filter((item) => tagFor(item.id) !== undefined).length;

  return (
    <>
      <div class="flex flex-col gap-3 px-4 pt-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PickOne
            value={step()}
            options={TRIAGE_STEPS}
            label={(one) => STEP_LABELS[one]}
            onChange={(one) => {
              selection.clear();
              url.push({ step: one });
            }}
          />

          <Show when={step() === "compare"}>
            <Select
              label="Tag"
              value={url.get("tag")}
              options={tagDefs().map((def) => def.id)}
              names={Object.fromEntries(
                tagDefs().map((def) => [def.id, def.label]),
              )}
              onChange={(tag) => url.replace({ tag, group: undefined })}
            />
          </Show>

          <Show when={step() === "tag"}>
            <Select
              label="Sort"
              value={url.get("sort")}
              options={TRIAGE_SORTS}
              names={SORT_LABELS}
              onChange={(sort) => url.replace({ sort })}
            />

            <Checkbox
              checked={url.get("tagged")}
              onChange={(tagged) => url.replace({ tagged })}
            >
              Show tagged
            </Checkbox>

            <Checkbox
              checked={url.get("guard")}
              onChange={(guard) => url.replace({ guard })}
            >
              Protect favorites from sweeps
            </Checkbox>
          </Show>

          <Show when={step() === "trash"}>
            <Checkbox
              checked={url.get("dry")}
              disabled={trashRun() !== undefined}
              onChange={(dry) => url.replace({ dry })}
            >
              Dry run
            </Checkbox>
          </Show>

          <Show when={app.loaded()}>
            <span class="ml-auto text-muted-foreground tabular-nums">
              {shown().length} of {plural(pool().length, "item")} · {tagged()}{" "}
              tagged
            </span>
          </Show>
        </div>

        <Show when={step() !== "trash"}>
          <TriageBar
            step={step()}
            selection={selection}
            writes={writes}
            pool={pool()}
            shown={shown()}
            guarded={url.get("guard")}
          />
        </Show>
      </div>

      <Show when={step() === "tag"}>
        <TriageFeed
          items={shown()}
          pool={pool()}
          selection={selection}
          onTag={onMenuTag}
        />
        <Rail />
      </Show>

      <Show when={step() === "compare"}>
        <TriageCompare pool={pool()} writes={writes} />
      </Show>

      <Show when={step() === "trash"}>
        <TriageTrash dry={url.get("dry")} />
      </Show>
    </>
  );
};
