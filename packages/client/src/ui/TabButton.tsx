import type { JSX } from "solid-js";

export const TabButton = (props: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: JSX.Element;
}) => (
  <button
    type="button"
    class="nav-tab"
    classList={{ active: props.active, disabled: props.disabled }}
    aria-pressed={props.active}
    disabled={props.disabled}
    onClick={() => props.onClick()}
  >
    {props.children}
  </button>
);
