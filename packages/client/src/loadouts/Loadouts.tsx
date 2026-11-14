import {
  createMemo,
  createResource,
  createSignal,
  Show,
  untrack,
} from "solid-js";

import { Loading } from "../components/lib/Loading.tsx";
import { SearchField } from "../components/lib/SearchField.tsx";
import { useApp } from "../core/app/state.ts";
import { messageOf } from "../core/error.ts";
import { useUrl } from "../core/router.ts";
import { forgetLookup, lookedUp, rememberLookup } from "./shared/history.ts";
import { LoadoutView } from "./shared/LoadoutView.tsx";
import { LookupHistory } from "./shared/LookupHistory.tsx";
import {
  fetchLoadout,
  lookupKey,
  resolveLoadout,
} from "./shared/sharedLoadout.ts";

export const Loadouts = () => {
  const app = useApp();
  const url = useUrl();

  const link = () => url.get("link")?.trim() || undefined;
  // A snapshot boot has no defs until the live pass
  const tier = createMemo(() => {
    const loaded = app.loaded();

    return loaded && loaded.session.support.size > 0 ? loaded.tier : undefined;
  });
  const needle = () => app.query().trim().toLowerCase();

  // The profile object changes every refresh
  const request = createMemo(() => {
    const wanted = link();
    const loadedTier = tier();

    return wanted && loadedTier
      ? { link: wanted, tier: loadedTier }
      : undefined;
  });

  const [history, setHistory] = createSignal(lookedUp());

  const [shared] = createResource(request, async ({ link }) => {
    // The request only exists once the profile has loaded
    const resolved = await resolveLoadout(
      untrack(app.loaded)!,
      await fetchLoadout(link),
    );

    setHistory(
      rememberLookup({
        key: lookupKey(link),
        link,
        name: resolved.loadout.name,
        classType: resolved.loadout.classType,
        subclass: resolved.subclass?.name,
      }),
    );

    return resolved;
  });

  const error = () => (link() ? shared.error : undefined);

  return (
    <div class="loadout-page flex flex-col gap-6 p-4">
      <SearchField
        wrapper="max-w-xl"
        placeholder="dim.gg or DIM loadout link"
        aria-label="Loadout link"
        value={url.get("link") ?? ""}
        onInput={(event) => url.type({ link: event.currentTarget.value })}
        onClear={() => url.push({ link: undefined })}
      />

      <Show when={!link() && history().length > 0}>
        <LookupHistory
          entries={history()}
          onOpen={(link) => url.push({ link })}
          onForget={(key) => setHistory(forgetLookup(key))}
        />
      </Show>

      <Show
        when={!error()}
        fallback={<p class="text-destructive">{messageOf(error())}</p>}
      >
        <Show when={shared.loading}>
          <Loading label="Loading loadout" />
        </Show>
        <Show when={!shared.loading && link() ? shared() : undefined}>
          {(ready) => <LoadoutView shared={ready()} needle={needle()} />}
        </Show>
      </Show>
    </div>
  );
};
