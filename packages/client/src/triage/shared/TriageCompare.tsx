import type { DimItem } from "app/inventory/item-types";
import { createEffect, createMemo, createSignal, on, Show } from "solid-js";

import { Compare } from "../../components/Compare.tsx";
import { PickOne } from "../../components/lib/PickOne.tsx";
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
  const url = useUrl();

  // Retagging would otherwise empty the table
  const [membership, setMembership] = createSignal<ReadonlySet<string>>(
    new Set(),
  );

  createEffect(
    on(
      () => url.get("tag"),
      (tagId) => setMembership(new Set(taggedIds(props.pool, tagId))),
    ),
  );

  // Grow only - a refresh empties the stores mid-way
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

  const byHash = (hash: string): Bundle | undefined =>
    bundles().find((one) => `${one.hash}` === hash);

  const bundle = (): Bundle | undefined => {
    const wanted = url.get("group");
    const held = bundles();

    return held.find((one) => one.hash === wanted) ?? held[0];
  };

  const kept = (item: DimItem) => tagFor(item.id)?.id !== url.get("tag");

  const sparedTag = () => (url.get("tag") === KEPT ? undefined : KEPT);

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
        <PickOne
          value={bundle() ? `${bundle()?.hash}` : undefined}
          options={bundles().map((one) => `${one.hash}`)}
          class="flex-wrap"
          label={(hash) => (
            <>
              <span class="max-w-60 truncate">{byHash(hash)?.name}</span>
              <span class="text-muted-foreground tabular-nums">
                {byHash(hash)?.items.length}
              </span>
            </>
          )}
          onChange={(hash) => url.push({ group: Number(hash) })}
        />

        <Show when={bundle()}>
          {(held) => (
            <Compare
              items={held().items}
              kept={kept}
              onKeep={onKeep}
              minColumn="220px"
            />
          )}
        </Show>
      </Show>
    </div>
  );
};
