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
  // Split out, since the gallery is for us and every byte of it would be on the first load
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
      root.textContent = e instanceof Error ? e.message : String(e);

      return;
    }
  }

  render(() => <App />, root);
};

void start();
