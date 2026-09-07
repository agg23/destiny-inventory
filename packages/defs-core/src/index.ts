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
  activityName,
  DIFFICULTIES,
  difficultyOf,
  slimActivity,
  slimActivityType,
  slimActivitySet,
  slimChallenge,
  slimDifficulty,
  slimGraphNode,
  slimMode,
  slimModifier,
  slimPlace,
  slimReward,
  slimVendor,
  skullTable,
  type GearTier,
  type SlimActivity,
  type SlimActivitySet,
  type SlimActivityType,
  type SlimChallenge,
  type SlimDifficulty,
  type SlimGraphNode,
  type SlimMode,
  type SlimModifier,
  type SlimPlace,
  type SlimReward,
  type SlimVendor,
  type SlimSkull,
  type SlimTier,
} from "./activities.ts";
