import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource, createSignal } from "solid-js";

import { holdAnchor, releaseAnchor } from "../../components/lib/anchor.ts";
import { categorize, matching } from "../../core/activities/activities.ts";
import {
  rewardsOf,
  type Values,
} from "../../core/activities/activityFormat.ts";
import { activityTables } from "../../core/activities/activityTables.ts";
import {
  bestTiming,
  type ActivityTiming,
  type HistoryRun,
} from "../../core/activities/history.ts";
import { BONUS_DROP_ITEM } from "../../core/activities/rewards.ts";
import type { Available, Loot, Realm } from "../../core/activities/types.ts";
import { useApp } from "../../core/app/state.ts";
import { useClock } from "../../core/clock.ts";
import { HOVER_DELAY } from "../../core/items/preview.ts";
import { builtFakes, fakeItems } from "../../core/profile/fakeItems.ts";
import { useUrl } from "../../core/router.ts";
import { runHref } from "../../core/url.ts";
import { activityLookup } from "../../history/shared/activityLookup.ts";
import { baseline } from "./baseline.ts";
import { HOUR, schedule } from "./distortion.ts";

export interface Hovered {
  entry: Available;
  cursorX: number | undefined;
}

export const createActivities = () => {
  const app = useApp();
  const url = useUrl();
  const [tables] = createResource(activityTables, {
    initialValue: activityTables.settled(),
  });
  const [captured] = createResource(baseline, {
    initialValue: baseline.settled(),
  });
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);

  const character = () => app.active()?.id;

  const now = useClock();
  const hour = createMemo(() => Math.floor(now() / HOUR));
  const turns = createMemo(() => schedule(hour() * HOUR));

  let hoverTimer: number | undefined = undefined;

  const hide = () => {
    releaseAnchor();
    setHovered(undefined);
  };

  const onHover = (
    entry: Available,
    element: HTMLElement,
    cursorX: number | undefined = undefined,
  ) => {
    const open = () => {
      holdAnchor(element, hide);
      setHovered({ entry, cursorX });
    };

    if (hovered()?.entry.key === entry.key) {
      open();

      return;
    }

    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(open, HOVER_DELAY);
  };

  const onLeave = (entry: Available) => {
    window.clearTimeout(hoverTimer);

    if (hovered()?.entry.key === entry.key) {
      hide();
    }
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
    hovered,
    onHover,
    onLeave,
    now,
    turns,
    pickRealm: (name: string) => {
      // The row unmounts without a mouseleave
      hide();
      url.push({ realm: name });
    },
  };
};

export type Data = ReturnType<typeof createActivities>;
