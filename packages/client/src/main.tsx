import { render } from "solid-js/web";

import { App } from "./App.tsx";
import { beginLogin, completeLogin, markDevLogin, signedIn } from "./auth.ts";
import "./tokens.css";
import "./style.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No #root");
}

const start = async () => {
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
      root.textContent = e instanceof Error ? e.message : String(e);

      return;
    }
  }

  render(() => <App />, root);
};

void start();
