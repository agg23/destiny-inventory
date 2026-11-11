import { useNavigate } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";

import { useCollectionData } from "../../collections/shared/collectionData.ts";
import { EntryList } from "../../collections/shared/EntryList.tsx";
import { Loading } from "../../components/lib/Loading.tsx";
import { PickOne } from "../../components/lib/PickOne.tsx";
import { Select } from "../../components/lib/Select.tsx";
import { HEADING, SECTION } from "../../components/lib/text.ts";
import { requireToken } from "../../core/api/auth.ts";
import { fetchUniqueWeapons } from "../../core/api/bungie.ts";
import { useApp } from "../../core/app/state.ts";
import { copiesByKey } from "../../core/collections/ownership.ts";
import {
  entryHref,
  USAGE_RARITIES,
  USAGE_SORTS,
  type UsageRarity,
  type UsageSort,
} from "../../core/url.ts";
import { sortUsage, weaponUsageOf } from "./usage.ts";

const RARITY_NAMES: Record<UsageRarity, string> = {
  exotic: "Exotics",
  legendary: "Legendaries",
};

const SORT_NAMES: Record<UsageSort, string> = {
  fewest: "Fewest kills",
  most: "Most kills",
  name: "Name",
};

export const UsageView = (props: {
  rarity: UsageRarity;
  order: UsageSort;
  onRarity: (rarity: UsageRarity) => void;
  onOrder: (order: UsageSort) => void;
}) => {
  const app = useApp();
  const navigate = useNavigate();
  const data = useCollectionData();

  const [history] = createResource(
    () => app.loaded()?.session.membership.membershipId,
    async () => {
      const membership = app.loaded()!.session.membership;
      const token = await requireToken();
      const characters = app.stores().filter((store) => !store.isVault);
      const weapons = await Promise.all(
        characters.map((store) =>
          fetchUniqueWeapons(membership, store.id, token),
        ),
      );

      return weapons.flat();
    },
  );

  const rows = createMemo(() => {
    const index = data.index();
    const held = history();

    if (!index || !held) {
      return [];
    }

    const usage = weaponUsageOf(
      index,
      copiesByKey(app.stores()),
      data.acquired.error ? undefined : data.acquired(),
      held,
    );
    const needle = app.query().trim().toLowerCase();

    return sortUsage(
      (props.rarity === "exotic" ? usage.exotics : usage.legendaries).filter(
        (row) => needle === "" || row.entry.name.toLowerCase().includes(needle),
      ),
      props.order,
    );
  });

  const kills = createMemo(
    () => new Map(rows().map((row) => [row.entry.key, row])),
  );

  return (
    <section class={SECTION}>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 class={HEADING}>All weapons</h2>
        <PickOne
          value={props.rarity}
          options={USAGE_RARITIES}
          label={(rarity) => RARITY_NAMES[rarity]}
          onChange={props.onRarity}
        />
        <Select
          label="Sort"
          value={props.order}
          options={USAGE_SORTS}
          names={SORT_NAMES}
          onChange={props.onOrder}
        />
      </div>

      <Show
        when={!history.error && !data.index.error}
        fallback={
          <p class="text-muted-foreground">Couldn't load weapon history.</p>
        }
      >
        <Show
          when={history() && data.index()}
          fallback={<Loading label="Loading weapon history" />}
        >
          <EntryList
            kind="weapon"
            entries={rows().map((row) => row.entry)}
            data={data}
            killsOf={(entry) => kills().get(entry.key)}
            byMode={props.rarity === "legendary"}
            onOpen={(entry) =>
              navigate(entryHref(entry.newestItemHash, { kind: "weapon" }))
            }
          />
        </Show>
      </Show>
    </section>
  );
};
