import { render } from "solid-js/web";

import { App } from "./App.tsx";
import { completeLogin, markDevLogin } from "./auth.ts";
import "./tokens.css";
import "./style.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No #root");
}

const start = async () => {
  markDevLogin();

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
