import type { JSX } from "solid-js";

/** Panel pinned beside the element currently holding the anchor */
export const AnchoredPanel = (props: {
  class: string;
  cursorX?: number;
  children: JSX.Element;
}) => (
  <aside
    class={`anchored ${props.class}`}
    classList={{ tracking: props.cursorX !== undefined }}
    style={
      props.cursorX === undefined
        ? undefined
        : { "--cursor-x": `${props.cursorX}px` }
    }
  >
    {props.children}
  </aside>
);
