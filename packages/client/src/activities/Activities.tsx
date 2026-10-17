import { createMemo, Show } from "solid-js";

import { PickOne } from "../components/lib/PickOne.tsx";
import { createActivities, type Data } from "./shared/activityData.ts";
import { BonusCount } from "./shared/BonusCount.tsx";
import { RunDetail } from "./shared/RunDetail.tsx";
import { RunTable, type Section } from "./shared/RunTable.tsx";
import { ZoneStrip } from "./shared/ZoneStrip.tsx";

const FEATURED = "Featured";

const Loading = (props: { data: Data }) => (
  <>
    <Show when={props.data.tables.error}>
      <p class="text-destructive">Activity definitions failed to load.</p>
    </Show>
    <Show when={props.data.realms().length === 0}>
      <p class="text-muted-foreground">
        <Show
          when={props.data.all().length > 0}
          fallback={<>Loading activities…</>}
        >
          Nothing matches that filter.
        </Show>
      </p>
    </Show>
  </>
);

export const Activities = () => {
  const data = createActivities();

  const sections = createMemo((): Section[] => {
    const realm = data.realm();

    if (!realm) {
      return [];
    }

    const picks = realm.categories
      .flatMap((one) => one.entries)
      .filter((one) => one.featured);
    const built: Section[] = [];

    if (picks.length > 0) {
      built.push({ name: FEATURED, entries: picks });
    }

    for (const category of realm.categories) {
      const entries = category.entries.filter((one) => !one.featured);

      if (entries.length > 0) {
        built.push({ name: category.name, entries });
      }
    }

    return built;
  });

  return (
    <div class="flex flex-col gap-3 p-4">
      <ZoneStrip data={data} />
      <Loading data={data} />
      <Show when={data.realms().length > 0}>
        <PickOne
          value={data.realm()?.name}
          options={data.realms().map((realm) => realm.name)}
          label={(name) => (
            <>
              {name}
              <BonusCount
                count={
                  data.realms().find((realm) => realm.name === name)
                    ?.bonusDrops ?? 0
                }
                glyph={data.glyph()}
              />
            </>
          )}
          onChange={data.pickRealm}
        />
        <RunTable data={data} sections={sections()} />
      </Show>
      <Show when={data.hovered()}>
        {(hovered) => <RunDetail data={data} hovered={hovered()} />}
      </Show>
    </div>
  );
};
