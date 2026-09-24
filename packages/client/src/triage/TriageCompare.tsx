import type { DimItem } from "app/inventory/item-types";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { useApp } from "../App.tsx";
import { Compare } from "../Compare.tsx";
import { useUrl } from "../router.ts";
import { tagFor } from "../tags.ts";
import { bundlesOf, taggedIds, type Bundle } from "../triage.ts";
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
    <div class="triage p-3">
      <Show
        when={bundles().length > 0}
        fallback={<p class="p-3 text-muted">Nothing carries that tag.</p>}
      >
        <div class="triage-groups">
          <For each={bundles()}>
            {(one) => (
              <button
                type="button"
                class="menu-item"
                classList={{ selected: bundle()?.hash === one.hash }}
                onClick={() => url.push({ group: one.hash })}
              >
                <span class="min-w-0 flex-1 truncate">{one.name}</span>
                <span class="text-dim">{one.items.length}</span>
              </button>
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
