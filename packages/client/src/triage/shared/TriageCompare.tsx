import type { DimItem } from "app/inventory/item-types";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { useApp } from "../../App.tsx";
import { Compare } from "../../components/Compare.tsx";
import { Button } from "../../components/lib/zaidan/button.tsx";
import { tagFor } from "../../core/items/tags.ts";
import { useUrl } from "../../core/router.ts";
import { bundlesOf, taggedIds, type Bundle } from "./triage.ts";
import type { Writes } from "./triageWrites.ts";

const KEPT = "keep";

interface Props {
  pool: DimItem[];
  writes: Writes;
}

export const TriageCompare = (props: Props) => {
  const app = useApp();
  const url = useUrl();

  // Captured on arrival so retagging inside the comparison cannot empty the table
  const [membership, setMembership] = createSignal<ReadonlySet<string>>(
    new Set(),
  );

  createEffect(
    on(
      () => url.get("tag"),
      (tagId) => setMembership(new Set(taggedIds(props.pool, tagId))),
    ),
  );

  // Stores and tags both land after this mounts, and a refresh empties the stores between
  createEffect(() => {
    const browsed = taggedIds(props.pool, url.get("tag"));

    setMembership((was) =>
      browsed.every((id) => was.has(id)) ? was : new Set([...was, ...browsed]),
    );
  });

  const bundles = createMemo(() => {
    const held = membership();

    return bundlesOf(props.pool.filter((item) => held.has(item.id)));
  });

  const bundle = (): Bundle | undefined => {
    const wanted = url.get("group");
    const held = bundles();

    return held.find((one) => one.hash === wanted) ?? held[0];
  };

  // Anything not carrying the tag you are working through is being spared
  const kept = (item: DimItem) => tagFor(item.id)?.id !== url.get("tag");

  // Sparing something already in the keep pile promotes it instead
  const sparedTag = () => (url.get("tag") === KEPT ? "favorite" : KEPT);

  const onKeep = (item: DimItem, keep: boolean) =>
    props.writes.apply(
      [{ targets: [item], tagId: keep ? sparedTag() : url.get("tag") }],
      `Tagged ${item.name}`,
    );

  return (
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4">
      <Show
        when={bundles().length > 0}
        fallback={
          <p class="text-muted-foreground">Nothing carries that tag.</p>
        }
      >
        <div class="flex flex-wrap gap-1.5">
          <For each={bundles()}>
            {(one) => (
              <Button
                size="sm"
                variant="outline"
                class="max-w-64"
                classList={{
                  "bg-muted": bundle()?.hash === one.hash,
                }}
                aria-pressed={bundle()?.hash === one.hash}
                onClick={() => url.push({ group: one.hash })}
              >
                <span class="min-w-0 truncate">{one.name}</span>
                <span class="text-muted-foreground tabular-nums">
                  {one.items.length}
                </span>
              </Button>
            )}
          </For>
        </div>

        <Show when={bundle()}>
          {(held) => (
            <Compare
              items={held().items}
              stores={app.stores()}
              active={app.active()}
              onMove={app.onMove}
              onPrefer={app.onCharacter}
              kept={kept}
              onKeep={onKeep}
              minColumn="220px"
              moving={app.moving()}
            />
          )}
        </Show>
      </Show>
    </div>
  );
};
