import { Show, type JSX } from "solid-js";

import { Button } from "./lib/zaidan/button.tsx";

interface Props {
  glyph?: JSX.Element;
  title: string;
  note: string;
  action: string;
  onAction: () => void;
  children?: JSX.Element;
}

/** A full-width warning bar with a title, a note, and an action */
export const WarningBanner = (props: Props) => (
  <div class="flex h-10 items-center gap-3 border-b border-warning/40 bg-warning/15 px-4 text-warning">
    <Show when={props.glyph}>
      {(glyph) => <span class="size-4.5">{glyph()}</span>}
    </Show>
    <span class="font-medium">{props.title}</span>
    <span class="mr-auto text-warning/70">{props.note}</span>
    <Button
      size="sm"
      variant="outline"
      class="border-warning/40 text-warning hover:bg-warning/15 hover:text-warning"
      onClick={() => props.onAction()}
    >
      {props.action}
    </Button>
    {props.children}
  </div>
);
