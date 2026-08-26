import type { DimItem } from "app/inventory/item-types";
import { createEffect, createMemo, createResource, For, Show } from "solid-js";

import { useApp } from "./App.tsx";
import { BUNGIE } from "./bungie.ts";
import { PageChrome } from "./chrome.tsx";
import {
  loadCollections,
  type CollectionEntry,
  type CollectionNode,
} from "./collections.ts";
import { fakeItems } from "./fakeItems.ts";
import { ItemDetails, ItemHead, typeName } from "./ItemPanel.tsx";
import { dismiss, preview } from "./preview.ts";
import { railCollapsed } from "./rail.ts";
import { useUrl } from "./router.ts";
import { settings } from "./settings.ts";

const RESULTS = 300;

const NodeCard = (props: { node: CollectionNode; onOpen: () => void }) => (
  <button type="button" class="card collection-card" onClick={props.onOpen}>
    <Show when={props.node.icon}>
      {(icon) => <img src={`${BUNGIE}${icon()}`} loading="lazy" alt="" />}
    </Show>
    <span class="collection-card-body">
      <span class="collection-card-name">{props.node.name}</span>
      <span class="text-muted">
        {props.node.acquired} of {props.node.total}
      </span>
    </span>
  </button>
);

const ItemCard = (props: {
  entry: CollectionEntry;
  item: DimItem | undefined;
  kind: string | undefined;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    class="card collection-item"
    classList={{
      unacquired: !props.entry.acquired,
      selected: props.selected,
    }}
    onClick={props.onSelect}
    onMouseEnter={(event) => {
      if (props.item) {
        preview(props.item, event.currentTarget);
      }
    }}
    onMouseLeave={() => props.item && dismiss(props.item)}
  >
    <span
      class="collection-item-icon"
      classList={{ [props.item?.rarity.toLowerCase() ?? "common"]: true }}
    >
      <Show when={props.item?.icon}>
        {(icon) => <img src={`${BUNGIE}${icon()}`} loading="lazy" alt="" />}
      </Show>
      <Show when={settings().overlay && props.item?.iconOverlay}>
        {(overlay) => (
          <img class="overlay" src={`${BUNGIE}${overlay()}`} alt="" />
        )}
      </Show>
    </span>
    <span class="collection-item-body">
      <span class="collection-item-name">{props.entry.name}</span>
      <Show when={props.kind}>
        {(kind) => <span class="text-muted">{kind()}</span>}
      </Show>
    </span>
  </button>
);

const NodeSummary = (props: { node: CollectionNode }) => (
  <div class="collection-summary">
    <h2 class="section-label">{props.node.name}</h2>
    <p class="collection-summary-count">
      {props.node.acquired}
      <span class="text-muted"> of {props.node.total}</span>
    </p>
    <Show when={props.node.children.length > 0}>
      <ul class="collection-summary-list">
        <For each={props.node.children}>
          {(child) => (
            <li>
              <span>{child.name}</span>
              <span class="text-muted">
                {child.acquired} / {child.total}
              </span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  </div>
);

export const Collections = () => {
  const app = useApp();
  const url = useUrl();

  const [tree] = createResource(
    () => app.loaded()?.session,
    (session) => loadCollections(session),
  );

  const current = (): CollectionNode | undefined =>
    tree()?.node(Number(url.get("node")));

  // The roots stand in for a node of their own at the top of the tree
  const home = createMemo<CollectionNode | undefined>(() => {
    const roots = tree()?.roots;

    if (!roots) {
      return undefined;
    }

    return {
      hash: 0,
      name: "Collections",
      icon: undefined,
      children: roots,
      entries: [],
      acquired: roots.reduce((total, root) => total + root.acquired, 0),
      total: roots.reduce((total, root) => total + root.total, 0),
    };
  });

  const viewing = () => current() ?? home();

  const trail = createMemo<CollectionNode[]>(() => {
    const held = tree();
    const node = current();

    if (!held || !node) {
      return [];
    }

    const path = [node];
    let parent = held.parent(node.hash);

    while (parent) {
      path.unshift(parent);
      parent = held.parent(parent.hash);
    }

    return path;
  });

  const needle = () => app.query().trim().toLowerCase();

  const descend = (node: CollectionNode): CollectionEntry[] => [
    ...node.entries,
    ...node.children.flatMap(descend),
  ];

  // Searching runs over the whole subtree, so a hit is reachable from any node above it
  const searched = createMemo<CollectionEntry[]>(() => {
    const scope = trail()[0];
    const roots = scope ? [scope] : tree()?.roots ?? [];

    return roots
      .flatMap(descend)
      .filter((entry) => entry.name.toLowerCase().includes(needle()))
      .slice(0, RESULTS);
  });

  const shown = createMemo<CollectionEntry[]>(() =>
    needle() === "" ? current()?.entries ?? [] : searched(),
  );

  const tiled = () => shown().filter((entry) => entry.itemHash !== undefined);

  const listed = () => shown().filter((entry) => entry.itemHash === undefined);

  const [items] = createResource(
    () => {
      const loaded = app.loaded();
      const hashes = tiled().flatMap((entry) =>
        entry.itemHash === undefined ? [] : [entry.itemHash],
      );

      return loaded && hashes.length > 0 ? { loaded, hashes } : undefined;
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
  );

  const [picked] = createResource(
    () => {
      const loaded = app.loaded();
      const hash = Number(url.get("item"));

      return loaded && Number.isFinite(hash) && hash > 0
        ? { loaded, hashes: [hash] }
        : undefined;
    },
    async ({ loaded, hashes }) =>
      (await fakeItems(loaded, hashes)).get(hashes[0]!),
  );

  // A resource holds its last value once its source goes away
  const focused = () => (url.get("item") === undefined ? undefined : picked());

  const itemFor = (entry: CollectionEntry): DimItem | undefined =>
    entry.itemHash === undefined ? undefined : items()?.get(entry.itemHash);

  // The type reads as noise under a node that is already one type
  const mixed = createMemo(() => {
    const kinds = new Set(
      tiled().flatMap((entry) => {
        const item = itemFor(entry);

        return item ? [item.typeName] : [];
      }),
    );

    return kinds.size > 1;
  });

  const kindOf = (entry: CollectionEntry): string | undefined => {
    const item = itemFor(entry);

    if (!item || !mixed() || item.typeName === "Unknown") {
      return undefined;
    }

    return typeName(item);
  };

  // A record carries no item hash, so the name is what marks the row
  const focusedName = () => focused()?.name.toLowerCase();

  const owned = (item: DimItem): number =>
    app
      .stores()
      .reduce(
        (total, store) =>
          total + store.items.filter((held) => held.hash === item.hash).length,
        0,
      );

  const floating = () => railCollapsed() && focused() !== undefined;

  const railed = () => !railCollapsed() || focused() !== undefined;

  const open = (node: CollectionNode | undefined) =>
    url.push({
      node: node === undefined ? undefined : String(node.hash),
      item: undefined,
    });

  // The card can sit deep in a grid of a few hundred, but scrolling a visible one jars
  createEffect(() => {
    if (url.get("item") === undefined || !items()) {
      return;
    }

    const card = document.querySelector(".collection-item.selected");

    if (!card) {
      return;
    }

    const box = card.getBoundingClientRect();

    if (box.top < 0 || box.bottom > window.innerHeight) {
      card.scrollIntoView({ block: "nearest" });
    }
  });

  // A search result names an item, not a node
  createEffect(() => {
    const held = tree();
    const hash = Number(url.get("item"));

    if (!held || url.get("node") !== undefined || !Number.isFinite(hash)) {
      return;
    }

    const found = held.locate(hash);

    if (!found) {
      return;
    }

    // The search matched a reissue the tree dropped, so the card and its rating are elsewhere
    url.replace({
      node: String(found.node.hash),
      item: found.itemHash === undefined ? undefined : String(found.itemHash),
    });
  });

  const cards = () => (needle() === "" ? viewing()?.children ?? [] : []);

  return (
    <>
      <PageChrome
        status={
          <Show
            when={needle() === ""}
            fallback={
              <span>
                {shown().length} matching in {trail()[0]?.name ?? "Collections"}
              </span>
            }
          >
            <Show when={viewing()}>
              {(node) => (
                <span>
                  {node().acquired} of {node().total} acquired
                  <Show
                    when={
                      node().entries.length > 0 &&
                      node().entries.length !== node().total
                    }
                  >
                    {" "}
                    · {node().entries.length} shown
                  </Show>
                </span>
              )}
            </Show>
          </Show>
        }
      />

      <Show when={tree.error}>
        <p class="p-3 text-danger">{(tree.error as Error).message}</p>
      </Show>

      <Show when={tree.loading}>
        <div class="loading">
          <span class="spinner" aria-hidden="true" />
          <p class="text-muted">Loading collections</p>
        </div>
      </Show>

      <Show when={tree()}>
        <div class="p-3">
          <Show when={trail().length > 0}>
            <nav class="breadcrumb">
              <button
                type="button"
                class="breadcrumb-step"
                onClick={() => open(undefined)}
              >
                Collections
              </button>
              <For each={trail()}>
                {(step) => (
                  <>
                    <span class="text-muted">›</span>
                    <button
                      type="button"
                      class="breadcrumb-step"
                      disabled={step.hash === current()?.hash}
                      onClick={() => open(step)}
                    >
                      {step.name}
                    </button>
                  </>
                )}
              </For>
            </nav>
          </Show>

          <Show when={cards().length > 0}>
            <div class="collection-cards">
              <For each={cards()}>
                {(child) => (
                  <NodeCard node={child} onOpen={() => open(child)} />
                )}
              </For>
            </div>
          </Show>

          <Show when={tiled().length > 0}>
            <div class="collection-items">
              <For each={tiled()}>
                {(entry) => (
                  <ItemCard
                    entry={entry}
                    item={itemFor(entry)}
                    kind={kindOf(entry)}
                    selected={url.get("item") === String(entry.itemHash)}
                    onSelect={() => url.push({ item: String(entry.itemHash) })}
                  />
                )}
              </For>
            </div>
          </Show>

          <Show when={listed().length > 0}>
            <ul class="collection-records">
              <For each={listed()}>
                {(entry) => (
                  <li
                    classList={{
                      unacquired: !entry.acquired,
                      selected: entry.name.toLowerCase() === focusedName(),
                    }}
                  >
                    <span>{entry.name}</span>
                    <Show when={entry.progress}>
                      {(progress) => (
                        <span class="text-muted">
                          {progress().value} / {progress().target}
                        </span>
                      )}
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>

      <Show when={railed()}>
        <aside class="rail" classList={{ floating: floating() }}>
          <Show
            when={focused()}
            fallback={
              <Show when={viewing()}>
                {(node) => <NodeSummary node={node()} />}
              </Show>
            }
          >
            {(item) => (
              <div class="item-tooltip overflow-y-auto p-4">
                <ItemHead item={item()} />
                <ItemDetails item={item()} allPerks />
                <p class="pt-2 text-sm text-muted">
                  {owned(item()) > 0
                    ? `You own ${owned(item())}`
                    : "None in your inventory"}
                </p>
              </div>
            )}
          </Show>
        </aside>
      </Show>
    </>
  );
};
