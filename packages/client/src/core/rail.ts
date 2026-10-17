import { createSignal } from "solid-js";

const KEY = "dvm.rail";

const [collapsed, setCollapsed] = createSignal(
  localStorage.getItem(KEY) === "collapsed",
);

/** True while the side panel is collapsed and floating */
export const railCollapsed = collapsed;

export const collapseRail = (next: boolean) => {
  setCollapsed(next);
  localStorage.setItem(KEY, next ? "collapsed" : "open");
};

// Pages built without a rail break beside it on narrow windows
const ROOMY = window.matchMedia("(min-width: 90rem)");

const [roomy, setRoomy] = createSignal(ROOMY.matches);

ROOMY.addEventListener("change", (event) => setRoomy(event.matches));

/** True while the window has room for the rail on pages without their own */
export const railRoomy = roomy;
