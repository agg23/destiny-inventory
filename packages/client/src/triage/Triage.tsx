import type { DimItem } from "app/inventory/item-types";
import { createMemo, For, Show } from "solid-js";

import { useApp } from "../App.tsx";
import { PageChrome } from "../chrome.tsx";
import { plural } from "../history/runFormat.ts";
import { Rail } from "../Rail.tsx";
import { useUrl } from "../router.ts";
import { tagDefs, tagFor } from "../tags.ts";
import { feed, triageable } from "../triage.ts";
import { TriageBar } from "./TriageBar.tsx";
import { TriageCompare } from "./TriageCompare.tsx";
import { TriageFeed } from "./TriageFeed.tsx";
import { createSelection } from "./triageSelection.ts";
import { createWrites } from "./triageWrites.ts";
import { TabButton } from "../ui/TabButton.tsx";
import { TRIAGE_SORTS, TRIAGE_STEPS, type TriageStep } from "../url.ts";

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
      <PageChrome
        tabs={
          <>
            <nav class="nav-subtabs">
              <For each={TRIAGE_STEPS}>
                {(one) => (
                  <TabButton
                    active={step() === one}
                    onClick={() => {
                      selection.clear();
                      url.push({ step: one });
                    }}
                  >
                    {STEP_LABELS[one]}
                  </TabButton>
                )}
              </For>
            </nav>

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
          </>
        }
        tools={
          <>
            <Show when={step() === "compare"}>
              <label class="flex items-center gap-2 text-md text-dim">
                Tag
                <select
                  class="select"
                  value={url.get("tag")}
                  onChange={(event) =>
                    url.replace({
                      tag: event.currentTarget.value,
                      group: undefined,
                    })
                  }
                >
                  <For each={tagDefs()}>
                    {(def) => <option value={def.id}>{def.label}</option>}
                  </For>
                </select>
              </label>
            </Show>

            <Show when={step() === "tag"}>
              <label class="flex items-center gap-2 text-md text-dim">
                Sort
                <select
                  class="select"
                  value={url.get("sort")}
                  onChange={(event) =>
                    url.replace({
                      sort: event.currentTarget
                        .value as (typeof TRIAGE_SORTS)[number],
                    })
                  }
                >
                  <For each={TRIAGE_SORTS}>
                    {(one) => <option value={one}>{SORT_LABELS[one]}</option>}
                  </For>
                </select>
              </label>

              <label class="flex items-center gap-2 text-md text-dim">
                <input
                  type="checkbox"
                  checked={url.get("tagged")}
                  onChange={(event) =>
                    url.replace({ tagged: event.currentTarget.checked })
                  }
                />
                Show tagged
              </label>

              <label class="flex items-center gap-2 text-md text-dim">
                <input
                  type="checkbox"
                  checked={url.get("guard")}
                  onChange={(event) =>
                    url.replace({ guard: event.currentTarget.checked })
                  }
                />
                Protect favorites from sweeps
              </label>
            </Show>
          </>
        }
        status={
          <Show when={app.loaded()}>
            <span>
              {shown().length} of {plural(pool().length, "item")} · {tagged()}{" "}
              tagged
            </span>
          </Show>
        }
      />

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
        <p class="p-6 text-muted">Not built yet.</p>
      </Show>
    </>
  );
};
