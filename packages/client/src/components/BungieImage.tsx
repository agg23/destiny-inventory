import { Show, type JSX } from "solid-js";

import { BUNGIE } from "../core/api/bungie.ts";

interface Props {
  path: string | false | undefined;
  class?: string;
  title?: string;
  lazy?: boolean;
  fallback?: JSX.Element;
}

/** An image from Bungie's CDN by its manifest path, or the fallback without one */
export const BungieImage = (props: Props) => (
  <Show when={props.path} fallback={props.fallback}>
    {(path) => (
      <img
        class={props.class}
        src={`${BUNGIE}${path()}`}
        alt=""
        title={props.title}
        loading={props.lazy ? "lazy" : undefined}
      />
    )}
  </Show>
);
