import { Navigate, Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { Activities } from "./Activities.tsx";
import { App } from "./App.tsx";
import { History } from "./history/History.tsx";
import { Todo } from "./todo/Todo.tsx";
import { Vault } from "./Vault.tsx";
import { beginLogin, completeLogin, markDevLogin, signedIn } from "./auth.ts";
import { messageOf } from "./error.ts";
import { primeBoot } from "./snapshot.ts";
import "./tokens.css";
import "./style.css";
import "./destiny.scss";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No #root");
}

const start = async () => {
  // Or the gallery lands on first load
  if (location.pathname === "/ui") {
    const { Gallery } = await import("./ui/Gallery.tsx");

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

  // Read before the first render, so the vault is in it
  const primed = signedIn() ? await primeBoot() : undefined;

  render(
    () => (
      <Router root={(props) => <App primed={primed}>{props.children}</App>}>
        <Route path="/vault" component={Vault} />
        <Route path="/activities" component={Activities} />
        <Route path="/todo" component={Todo} />
        <Route
          path={["/history", "/history/activity/:label"]}
          component={History}
        />
        <Route path="*" component={() => <Navigate href="/vault" />} />
      </Router>
    ),
    root,
  );
};

void start();
