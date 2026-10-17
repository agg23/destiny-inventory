import type { JSX } from "solid-js";

import { Button } from "./lib/zaidan/button.tsx";

/** A ghost button back to the page before */
export const BackButton = (props: {
  onClick: () => void;
  children: JSX.Element;
}) => (
  <Button size="sm" variant="ghost" class="self-start" onClick={props.onClick}>
    &larr; {props.children}
  </Button>
);
