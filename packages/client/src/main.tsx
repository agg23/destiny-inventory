import { Navigate, Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { Activities } from "./activities/Activities.tsx";
import { GuidePage } from "./activities/GuidePage.tsx";
import { App } from "./App.tsx";
import { Collections } from "./collections/Collections.tsx";
import { EntryPage } from "./collections/EntryPage.tsx";
import {
  beginLogin,
  completeLogin,
  markDevLogin,
  signedIn,
} from "./core/api/auth.ts";
import { messageOf } from "./core/error.ts";
import { primeBoot } from "./core/profile/snapshot.ts";
import { History } from "./history/History.tsx";
import { Stats } from "./stats/Stats.tsx";
import { Todo } from "./todo/Todo.tsx";
import { Triage } from "./triage/Triage.tsx";
import { Vault } from "./vault/Vault.tsx";
import "./tokens.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No #root");
}

const start = async () => {
  // Or the gallery lands on first load
  if (location.pathname === "/ui") {
    const { Gallery } = await import("./gallery/Gallery.tsx");

    render(() => <Gallery />, root);

    return;
  }

  if (markDevLogin() && !signedIn()) {
    await beginLogin();

    return;
  }

  if (location.pathname === "/auth/callback") {
    try {
      if (await completeLogin()) {
        return;
      }
    } catch (e) {
      root.textContent = messageOf(e);

      return;
    }
  }

  const primed = signedIn() ? await primeBoot() : undefined;

  render(
    () => (
      <Router root={(props) => <App primed={primed}>{props.children}</App>}>
        <Route path="/vault" component={Vault} />
        <Route path="/triage" component={Triage} />
        <Route path="/collections" component={Collections} />
        <Route path="/collections/:hash" component={EntryPage} />
        <Route path="/activities" component={Activities} />
        <Route path="/activities/guide/:label" component={GuidePage} />
        <Route path="/todo" component={Todo} />
        <Route
          path={["/history", "/history/activity/:label"]}
          component={History}
        />
        <Route path="/stats" component={Stats} />
        <Route path="*" component={() => <Navigate href="/vault" />} />
      </Router>
    ),
    root,
  );
};

void start();
