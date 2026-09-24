import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { plural } from "../history/runFormat.ts";
import { tagDefs } from "../tags.ts";
import { showToast } from "../toast.tsx";
import { sweepFor } from "../triage.ts";
import type { Selection } from "./triageSelection.ts";
import type { Writes } from "./triageWrites.ts";
import { Button } from "../ui/Button.tsx";
import type { TriageStep } from "../url.ts";

const copies = (count: number): string =>
  `${count} other ${count === 1 ? "copy" : "copies"}`;

interface Props {
  step: TriageStep;
  selection: Selection;
  writes: Writes;
  pool: DimItem[];
  shown: DimItem[];
  guarded: boolean;
}

export const TriageBar = (props: Props) => {
  const chosen = () => props.selection.items();

  const askBulk = (tagId: string | undefined, label: string) => {
    const targets = chosen();

    if (targets.length === 0) {
      showToast("Nothing is selected");

      return;
    }

    props.writes.ask({
      label: `${label} ${plural(targets.length, "item")}`,
      note: undefined,
      writes: [{ targets, tagId }],
    });
  };

  const askSweep = () => {
    const [one] = chosen();

    if (!one) {
      return;
    }

    const sweep = sweepFor(one, props.pool, props.shown, props.guarded);

    if (sweep.targets.length === 0) {
      showToast(
        sweep.guarded > 0
          ? `Nothing to junk - ${copies(sweep.guarded)} protected`
          : `No other copies of ${one.name}`,
      );

      return;
    }

    const notes = [
      sweep.guarded > 0 ? `${sweep.guarded} protected, skipped` : "",
      sweep.offscreen > 0 ? `${sweep.offscreen} not shown` : "",
    ].filter((part) => part.length > 0);

    props.writes.ask({
      label: `Junk ${copies(sweep.targets.length)} of ${one.name}`,
      note: notes.length > 0 ? notes.join(" · ") : undefined,
      writes: [{ targets: sweep.targets, tagId: "junk" }],
    });
  };

  const onCommit = () => {
    props.writes.commit();
    props.selection.clear();
  };

  return (
    <div class="triage-bar">
      <Show
        when={props.writes.pending()}
        fallback={
          <>
            <Show when={props.step === "tag"}>
              <span class="triage-scope">
                <Show
                  when={chosen().length > 0}
                  fallback={
                    <span class="text-muted">Select items to tag them</span>
                  }
                >
                  {plural(chosen().length, "item")} selected
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={props.selection.clear}
                  >
                    Clear
                  </Button>
                </Show>
              </span>
            </Show>

            <span class="triage-actions">
              <Show when={props.writes.undone()}>
                {(held) => (
                  <Button size="xs" variant="light" onClick={props.writes.undo}>
                    Undo · {held().label}
                  </Button>
                )}
              </Show>

              <Show when={props.step === "tag"}>
                <For each={tagDefs()}>
                  {(def) => (
                    <Button
                      size="xs"
                      class="tag-button"
                      style={{ "--tag-color": `var(--color-${def.color})` }}
                      disabled={chosen().length === 0}
                      onClick={() => askBulk(def.id, def.label)}
                    >
                      {def.label}
                    </Button>
                  )}
                </For>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={chosen().length === 0}
                  onClick={() => askBulk(undefined, "Clear the tag on")}
                >
                  Clear tag
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  disabled={chosen().length !== 1}
                  title={
                    chosen().length === 1
                      ? undefined
                      : "Select exactly one item to keep"
                  }
                  onClick={askSweep}
                >
                  Keep this, junk the rest
                </Button>
              </Show>
            </span>
          </>
        }
      >
        {(held) => (
          <>
            <span class="triage-scope">
              {held().label}
              <Show when={held().note}>
                {(note) => <span class="text-dim"> · {note()}</span>}
              </Show>
            </span>

            <span class="triage-actions">
              <Button size="xs" onClick={onCommit}>
                Confirm
              </Button>
              <Button size="xs" variant="ghost" onClick={props.writes.cancel}>
                Cancel
              </Button>
            </span>
          </>
        )}
      </Show>
    </div>
  );
};
