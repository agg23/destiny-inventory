export {
  resolveClosure,
  validate,
  type Closure,
  type Dangling,
  type Tables,
} from "./closure.ts";
export {
  itemReferences,
  plugSetReferences,
  type ItemReferences,
} from "./references.ts";
export {
  coreItem,
  detailItem,
  hasDetail,
  slimItem,
  type SlimItem,
} from "./projection.ts";
export { isShipped } from "./shipped.ts";
export {
  materializeClosure,
  type AsyncTables,
  type Materialized,
} from "./materialize.ts";
export {
  slimActivity,
  slimActivityType,
  slimActivitySet,
  slimChallenge,
  slimDifficulty,
  slimGraphNode,
  slimModifier,
  slimPlace,
  slimReward,
  type ArtSource,
  type SlimActivity,
  type SlimActivitySet,
  type SlimActivityType,
  type SlimChallenge,
  type SlimDifficulty,
  type SlimGraphNode,
  type SlimModifier,
  type SlimPlace,
  type SlimReward,
  type SlimTier,
} from "./activities.ts";
