import type { JSX } from "solid-js";

export const TabButton = (props: {
  active: boolean;
  onClick: () => void;
  children: JSX.Element;
}) => (
  <button
    type="button"
    class="nav-tab"
    classList={{ active: props.active }}
    aria-pressed={props.active}
    onClick={() => props.onClick()}
  >
    {props.children}
  </button>
);
