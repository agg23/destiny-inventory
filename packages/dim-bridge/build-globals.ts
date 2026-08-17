// DIM reads these as free variables, ReferenceError without them
// Credentials stay empty, ours live in .env

const FEATURE_FLAGS = {
  debugMoves: false,
  debugSW: false,
  sentry: false,
  wishLists: true,
  issueBanner: false,
  triage: true,
  awa: false,
  itemFeed: true,
  clarityDescriptions: true,
  elgatoStreamDeck: false,
  warnNoSync: false,
  loAutoStatMods: true,
  simulateBungieMaintenance: false,
  simulateMissingSockets: false,
  solsticePresentationNodes: false,
  customStatWeights: false,
  runLoInBackground: false,
  editInGameLoadoutIdentifiers: false,
  dimApiSync: false,
};

export const DIM_GLOBALS: Record<string, string> = {
  $featureFlags: JSON.stringify(FEATURE_FLAGS),
  $DIM_VERSION: JSON.stringify("0.0.0"),
  $DIM_FLAVOR: JSON.stringify("dev"),
  $ANALYTICS_PROPERTY: JSON.stringify(""),
  $PUBLIC_PATH: JSON.stringify("/"),
  $DIM_API_KEY: JSON.stringify(""),
  $DIM_WEB_API_KEY: JSON.stringify(""),
  $DIM_WEB_CLIENT_ID: JSON.stringify(""),
  $DIM_WEB_CLIENT_SECRET: JSON.stringify(""),
};
