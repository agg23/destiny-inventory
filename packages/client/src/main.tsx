import { render } from "solid-js/web";

import { App } from "./App.tsx";
import "./style.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No #root");
}

render(() => <App />, root);
