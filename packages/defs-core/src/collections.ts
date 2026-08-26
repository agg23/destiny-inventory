import type {
  DestinyCollectibleDefinition,
  DestinyPresentationNodeDefinition,
} from "bungie-api-ts/destiny2";

export type SlimCollectible = Pick<
  DestinyCollectibleDefinition,
  | "hash"
  | "displayProperties"
  | "itemHash"
  | "sourceString"
  | "sourceHash"
  | "parentNodeHashes"
  | "scope"
  | "redacted"
>;

export const slimCollectible = (
  collectible: DestinyCollectibleDefinition,
): SlimCollectible => ({
  hash: collectible.hash,
  displayProperties: collectible.displayProperties,
  itemHash: collectible.itemHash,
  sourceString: collectible.sourceString,
  sourceHash: collectible.sourceHash,
  parentNodeHashes: collectible.parentNodeHashes,
  scope: collectible.scope,
  redacted: collectible.redacted,
});

export type SlimPresentationNode = Pick<
  DestinyPresentationNodeDefinition,
  | "hash"
  | "displayProperties"
  | "children"
  | "parentNodeHashes"
  | "presentationNodeType"
  | "objectiveHash"
  | "completionRecordHash"
  | "nodeType"
  | "redacted"
>;

export const slimPresentationNode = (
  node: DestinyPresentationNodeDefinition,
): SlimPresentationNode => ({
  hash: node.hash,
  displayProperties: node.displayProperties,
  children: node.children,
  parentNodeHashes: node.parentNodeHashes,
  presentationNodeType: node.presentationNodeType,
  objectiveHash: node.objectiveHash,
  completionRecordHash: node.completionRecordHash,
  nodeType: node.nodeType,
  redacted: node.redacted,
});
