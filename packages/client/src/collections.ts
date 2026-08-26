import {
  DestinyCollectibleState,
  DestinyPresentationNodeState,
  DestinyRecordState,
  DestinyScope,
  type DestinyCollectibleDefinition,
  type DestinyPresentationNodeDefinition,
  type DestinyProfileResponse,
  type DestinyRecordComponent,
  type DestinyRecordDefinition,
} from "bungie-api-ts/destiny2";

import { accessToken } from "./auth.ts";
import { fetchTable } from "./artifacts.ts";
import { fetchCollectionsProfile, fetchCoreSettings } from "./bungie.ts";
import { NotSignedIn, type Session } from "./load.ts";
import { nameTable } from "./names.ts";
import { ratingFor } from "./rolls.ts";

export type EntryKind = "collectible" | "record" | "craftable";

export interface CollectionEntry {
  kind: EntryKind;
  hash: number;
  itemHash: number | undefined;
  name: string;
  acquired: boolean;
  progress: { value: number; target: number } | undefined;
}

export interface CollectionNode {
  hash: number;
  name: string;
  icon: string | undefined;
  children: CollectionNode[];
  entries: CollectionEntry[];
  acquired: number;
  total: number;
}

export interface Located {
  node: CollectionNode;
  /** The reissue the tree kept, which is not always the one the search matched */
  itemHash: number | undefined;
}

export interface Collections {
  roots: CollectionNode[];
  node: (hash: number) => CollectionNode | undefined;
  parent: (hash: number) => CollectionNode | undefined;
  /** Where an item sits, for jumping from a search result into the tree */
  locate: (itemHash: number) => Located | undefined;
}

type CollectibleTable = Record<string, DestinyCollectibleDefinition>;
type NodeTable = Record<string, DestinyPresentationNodeDefinition>;
type RecordTable = Record<string, DestinyRecordDefinition>;
type NameTable = Map<number, { name: string }>;

const collectibleState = (
  collectible: DestinyCollectibleDefinition,
  profile: DestinyProfileResponse,
): number | undefined => {
  if (collectible.scope !== DestinyScope.Character) {
    return profile.profileCollectibles?.data?.collectibles[collectible.hash]
      ?.state;
  }

  const held = Object.values(profile.characterCollectibles?.data ?? {}).flatMap(
    (character) => {
      const state = character.collectibles[collectible.hash]?.state;

      return state === undefined ? [] : [state];
    },
  );

  // A collectible unlocked on any character counts as acquired
  const unlocked = held.find(
    (state) => !(state & DestinyCollectibleState.NotAcquired),
  );

  return unlocked ?? held[0];
};

const recordComponent = (
  hash: number,
  scope: number,
  profile: DestinyProfileResponse,
): DestinyRecordComponent | undefined => {
  if (scope !== DestinyScope.Character) {
    return profile.profileRecords?.data?.records[hash];
  }

  const [first] = Object.values(profile.characterRecords?.data ?? {});

  return first?.records[hash];
};

const craftable = (itemHash: number, profile: DestinyProfileResponse) => {
  const all = Object.values(profile.characterCraftables?.data ?? {}).flatMap(
    (character) => {
      const held = character.craftables[itemHash];

      return held === undefined ? [] : [held];
    },
  );

  return all.find((entry) => entry.visible) ?? all[0];
};

const collectibleEntries = (
  node: DestinyPresentationNodeDefinition,
  collectibles: CollectibleTable,
  names: NameTable,
  profile: DestinyProfileResponse,
): CollectionEntry[] =>
  (node.children.collectibles ?? []).flatMap(({ collectibleHash }) => {
    const collectible = collectibles[collectibleHash];

    if (!collectible || collectible.redacted) {
      return [];
    }

    const state = collectibleState(collectible, profile);

    if (state === undefined || state & DestinyCollectibleState.Invisible) {
      return [];
    }

    return [
      {
        kind: "collectible" as const,
        hash: collectibleHash,
        itemHash: collectible.itemHash,
        name:
          names.get(collectible.itemHash)?.name ??
          collectible.displayProperties.name,
        acquired: !(state & DestinyCollectibleState.NotAcquired),
        progress: undefined,
      },
    ];
  });

const recordEntries = (
  node: DestinyPresentationNodeDefinition,
  records: RecordTable,
  profile: DestinyProfileResponse,
): CollectionEntry[] =>
  (node.children.records ?? []).flatMap(({ recordHash }) => {
    const record = records[recordHash];

    if (!record || record.redacted) {
      return [];
    }

    const held = recordComponent(recordHash, record.scope, profile);

    if (held === undefined || held.state & DestinyRecordState.Invisible) {
      return [];
    }

    const objective = held.objectives?.[0];

    return [
      {
        kind: "record" as const,
        hash: recordHash,
        itemHash: record.rewardItems?.[0]?.itemHash,
        progress: objective && {
          value: objective.progress ?? 0,
          target: objective.completionValue,
        },
        name:
          held.state & DestinyRecordState.Obscured
            ? record.stateInfo?.obscuredName || record.displayProperties.name
            : record.displayProperties.name,
        acquired: !(held.state & DestinyRecordState.ObjectiveNotCompleted),
      },
    ];
  });

const craftableEntries = (
  node: DestinyPresentationNodeDefinition,
  names: NameTable,
  profile: DestinyProfileResponse,
): CollectionEntry[] =>
  (node.children.craftables ?? []).flatMap(({ craftableItemHash }) => {
    const held = craftable(craftableItemHash, profile);

    if (!held?.visible) {
      return [];
    }

    return [
      {
        kind: "craftable" as const,
        hash: craftableItemHash,
        itemHash: craftableItemHash,
        name: names.get(craftableItemHash)?.name ?? "",
        acquired: held.failedRequirementIndexes.length === 0,
        progress: undefined,
      },
    ];
  });

// A weapon has a collectible per reissue. Aegis rates one of them, and that is the one
// worth keeping, since the others carry no rating and no vault match
const distinct = (entries: CollectionEntry[]): CollectionEntry[] => {
  const byName = new Map<string, CollectionEntry>();

  const score = (entry: CollectionEntry): number =>
    (entry.itemHash !== undefined && ratingFor(entry.itemHash) ? 4 : 0) +
    (entry.acquired ? 2 : 0) +
    (entry.itemHash !== undefined ? 1 : 0);

  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    const held = byName.get(key);

    if (!held || score(entry) > score(held)) {
      byName.set(key, entry);
    }
  }

  return [...byName.values()];
};

interface Build {
  nodes: NodeTable;
  collectibles: CollectibleTable;
  records: RecordTable;
  names: NameTable;
  profile: DestinyProfileResponse;
  byHash: Map<number, CollectionNode>;
  parents: Map<number, number>;
  byItem: Map<number, number>;
  byName: Map<string, { node: number; itemHash: number | undefined }>;
}

const buildNode = (
  hash: number,
  build: Build,
  seen: Set<number>,
): CollectionNode | undefined => {
  const definition = build.nodes[hash];

  if (!definition || definition.redacted || seen.has(hash)) {
    return undefined;
  }

  const component =
    build.profile.profilePresentationNodes?.data?.nodes[hash]?.state ?? 0;

  if (component & DestinyPresentationNodeState.Invisible) {
    return undefined;
  }

  seen.add(hash);

  const entries = [
    ...collectibleEntries(
      definition,
      build.collectibles,
      build.names,
      build.profile,
    ),
    ...recordEntries(definition, build.records, build.profile),
    ...craftableEntries(definition, build.names, build.profile),
  ];

  const children = (definition.children.presentationNodes ?? []).flatMap(
    (child) => {
      const built = buildNode(child.presentationNodeHash, build, seen);

      return built === undefined ? [] : [built];
    },
  );

  // Counts stay over every reissue, so they read the same as the game's own
  const node: CollectionNode = {
    hash,
    name: definition.displayProperties.name,
    icon: definition.displayProperties.icon,
    children,
    entries: distinct(entries),
    acquired:
      entries.filter((entry) => entry.acquired).length +
      children.reduce((total, child) => total + child.acquired, 0),
    total:
      entries.length +
      children.reduce((total, child) => total + child.total, 0),
  };

  build.byHash.set(hash, node);

  for (const child of children) {
    build.parents.set(child.hash, hash);
  }

  for (const entry of entries) {
    if (entry.itemHash !== undefined && !build.byItem.has(entry.itemHash)) {
      build.byItem.set(entry.itemHash, hash);
    }
  }

  for (const entry of node.entries) {
    const name = entry.name.toLowerCase();

    if (name !== "" && !build.byName.has(name)) {
      build.byName.set(name, { node: hash, itemHash: entry.itemHash });
    }
  }

  return node;
};

let pending: Promise<Collections> | undefined = undefined;

const build = async (session: Session): Promise<Collections> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const [collectibles, nodes, records, names, settings, profile] =
    await Promise.all([
      fetchTable<CollectibleTable>(session.index, "Collectible"),
      fetchTable<NodeTable>(session.index, "PresentationNode"),
      fetchTable<RecordTable>(session.index, "Record"),
      nameTable(session.index),
      fetchCoreSettings(token),
      fetchCollectionsProfile(session.membership, token),
    ]);

  const core = settings.destiny2CoreSettings;
  const state: Build = {
    nodes,
    collectibles,
    records,
    names,
    profile,
    byHash: new Map(),
    parents: new Map(),
    byItem: new Map(),
    byName: new Map(),
  };

  const seen = new Set<number>();

  const roots = [
    core.collectionRootNode,
    core.exoticCatalystsRootNodeHash,
    core.craftingRootNodeHash,
  ].flatMap((hash) => {
    const built = buildNode(hash, state, seen);

    return built === undefined ? [] : [built];
  });

  // Both crafting roots wrap their real contents in a node of the same name
  const unwrapped = roots.map((root) => {
    const only = root.children[0];

    if (root.entries.length > 0 || root.children.length !== 1 || !only) {
      return root;
    }

    state.parents.delete(only.hash);

    return only;
  });

  return {
    roots: unwrapped,
    node: (hash) => state.byHash.get(hash),
    parent: (hash) => {
      const parent = state.parents.get(hash);

      return parent === undefined ? undefined : state.byHash.get(parent);
    },
    // A search hit names a reissue the tree may have dropped, and a catalyst has no item
    // of its own, so both resolve through the name
    locate: (itemHash) => {
      const named = state.names.get(itemHash)?.name.toLowerCase();
      const held = named === undefined ? undefined : state.byName.get(named);

      if (held) {
        const node = state.byHash.get(held.node);

        return node && { node, itemHash: held.itemHash };
      }

      const owning = state.byItem.get(itemHash);
      const node = owning === undefined ? undefined : state.byHash.get(owning);

      return node && { node, itemHash };
    },
  };
};

/** The collections tree, fetched and built once per session */
export const loadCollections = (session: Session): Promise<Collections> => {
  pending ??= build(session);

  return pending;
};
