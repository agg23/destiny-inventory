import {
  createEffect,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
} from "solid-js";

import { NotSignedIn, signedIn } from "../api/auth.ts";
import type { Membership } from "../api/bungie.ts";
import { definedSession } from "../collections/collections.ts";
import { messageOf } from "../error.ts";
import {
  guestLabel,
  guestParam,
  readGuestParam,
  rememberedGuests,
  rememberGuest,
  sameMembership,
  setGuest,
  type Guest,
} from "../profile/guest.ts";
import { load } from "../profile/load.ts";
import { loadGuest } from "../profile/loadGuest.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import type { Url } from "../router.ts";
import { showToast } from "../toast.ts";

export const createSession = (url: Url, primed: LoadResult | undefined) => {
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(
    undefined,
  );
  const viewing = createMemo<Membership | undefined>((was) => {
    const next = readGuestParam(url.get("guest"));

    return sameMembership(was, next) ? was : next;
  });

  createRenderEffect(() => setGuest(viewing()));
  const [liveFailed, setLiveFailed] = createSignal(false);
  const [expired, setExpired] = createSignal(false);

  const onLiveError = (e: unknown) => {
    if (e instanceof NotSignedIn) {
      setExpired(true);

      return;
    }

    setLiveFailed(true);
    showToast(messageOf(e), "danger");
  };

  // Reading an errored resource rethrows
  const [authed] = createSignal(signedIn());
  const [result] = createResource(
    () => authed() || undefined,
    () => load(setUpgraded, onLiveError, primed),
    { initialValue: primed },
  );

  const error = () => result.error as Error | undefined;
  const owned = () => (error() ? undefined : upgraded() ?? result());

  const [guestResult, { refetch: refetchGuest }] = createResource(
    // A snapshot paint has no definitions to build a guest against
    () => (definedSession(owned()?.session) ? viewing() : undefined),
    (who) => loadGuest(owned()!, who),
  );

  const guestError = () => guestResult.error as Error | undefined;
  const current = () => (viewing() ? guestResult() : owned());
  const awaitingLive = () => current()?.source === "cache" && !liveFailed();
  const needsSignIn = () =>
    !authed() || expired() || error() instanceof NotSignedIn;

  createEffect(() => {
    const who = current()?.session.guest;

    if (who) {
      rememberGuest(who);
    }
  });

  const guestName = () => {
    const who = viewing();

    if (!who) {
      return "";
    }

    const held = rememberedGuests().find((entry) => sameMembership(entry, who));

    if (held) {
      return guestLabel(held);
    }

    const loaded = current()?.session.guest;

    return loaded && sameMembership(loaded, who)
      ? guestLabel(loaded)
      : "Loading";
  };

  const onGuest = (who: Guest) => {
    rememberGuest(who);
    url.push({ guest: guestParam(who), character: undefined, pin: [] });
  };

  const onLeave = () => {
    url.push({ guest: undefined, character: undefined, pin: [] });
  };

  return {
    authed,
    viewing,
    current,
    error,
    guestError,
    loading: () => result.loading || guestResult.loading,
    awaitingLive,
    needsSignIn,
    guestName,
    onGuest,
    onLeave,
    setUpgraded,
    refetchGuest,
  };
};
