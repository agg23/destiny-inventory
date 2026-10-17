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
