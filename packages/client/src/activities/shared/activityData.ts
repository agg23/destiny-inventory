import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource } from "solid-js";

import { categorize, matching } from "../../core/activities/activities.ts";
import {
  rewardsOf,
  type Values,
} from "../../core/activities/activityFormat.ts";
import { activityLookup } from "../../core/activities/activityLookup.ts";
import { useActivityTables } from "../../core/activities/activityTables.ts";
import {
  bestTiming,
  type ActivityTiming,
  type HistoryRun,
} from "../../core/activities/history.ts";
import { BONUS_DROP_ITEM } from "../../core/activities/rewards.ts";
import type { Available, Loot, Realm } from "../../core/activities/types.ts";
import { useApp } from "../../core/app/state.ts";
import { useClock } from "../../core/clock.ts";
import { createHoverCard, HOVER_DELAY } from "../../core/items/preview.ts";
import { builtFakes, fakeItems } from "../../core/profile/fakeItems.ts";
import { useUrl } from "../../core/router.ts";
import { HOUR } from "../../core/time.ts";
import { runHref } from "../../core/url.ts";
import { baseline } from "./baseline.ts";
import { schedule } from "./distortion.ts";

export interface Hovered {
  entry: Available;
  cursorX: number | undefined;
}

export const createActivities = () => {
  const app = useApp();
  const url = useUrl();
  const tables = useActivityTables();
  const [captured] = createResource(baseline, {
    initialValue: baseline.settled(),
  });
  const card = createHoverCard<Hovered>({
    delay: HOVER_DELAY,
    reopen: (shown, next) => shown.entry.key === next.entry.key,
  });

  const character = () => app.active()?.id;

  const now = useClock();
  const hour = createMemo(() => Math.floor(now() / HOUR));
  const turns = createMemo(() => schedule(hour() * HOUR));

  const onHover = (
    entry: Available,
    element: HTMLElement,
    cursorX: number | undefined = undefined,
  ) => {
    card.open({ entry, cursorX }, element);
  };

  const onLeave = (entry: Available) => {
    card.dismiss((shown) => shown.entry.key === entry.key);
  };

  const all = (): Realm[] => {
    const loaded = tables();
    const held = character();
    const entries =
      held === undefined
        ? undefined
        : app.loaded()?.activities[held]?.availableActivities;

    if (!loaded || !entries) {
      return [];
    }

    return categorize([...entries], loaded, (hash) => captured()?.rows[hash]);
  };

  const realms = createMemo(() => matching(all(), app.query()));

  const realm = createMemo((): Realm | undefined => {
    const found = realms();

    return found.find((one) => one.name === url.get("realm")) ?? found[0];
  });

  const values = (): Values =>
    (character() === undefined
      ? undefined
      : app.loaded()?.variables[character() ?? ""]) ?? {};

  const glyph = () => tables()?.rewards[BONUS_DROP_ITEM]?.icon;

  const lookup = createMemo(() => activityLookup(tables()));

  const hrefFor = (run: HistoryRun): string =>
    runHref(lookup().labelOf(run), lookup().rungOf(run), run.instanceId);

  const timingFor = (entry: Available): ActivityTiming | undefined =>
    bestTiming(app.timings(), [
      entry.hash,
      ...entry.variants.map((one) => one.hash),
    ]);

  const rewardHashes = createMemo(() => [
    ...new Set(
      realms()
        .flatMap((one) => one.categories)
        .flatMap((one) => one.entries)
        .flatMap((entry) => rewardsOf(entry).map((one) => one.loot.hash)),
    ),
  ]);

  const [items] = createResource(
    () => {
      const loaded = app.loaded();
      const hashes = rewardHashes();

      return loaded && hashes.length > 0 ? { loaded, hashes } : undefined;
    },
    ({ loaded, hashes }) => fakeItems(loaded, hashes),
    { initialValue: builtFakes(rewardHashes()) },
  );

  return {
    app,
    tables,
    all,
    realms,
    realm,
    values,
    glyph,
    hrefFor,
    timingFor,
    itemFor: (loot: Loot): DimItem | undefined => items()?.get(loot.hash),
    hovered: card.shown,
    onHover,
    onLeave,
    now,
    turns,
    pickRealm: (name: string) => {
      // The row unmounts without a mouseleave
      card.clear();
      url.push({ realm: name });
    },
  };
};

export type Data = ReturnType<typeof createActivities>;
