import { ActivityFacts } from "../../components/ActivityFacts.tsx";
import { AnchoredPanel } from "../../components/lib/AnchoredPanel.tsx";
import { where } from "../../core/activities/activityFormat.ts";
import { tileArt } from "../../core/activities/art.ts";
import type { Data, Hovered } from "./activityData.ts";

export const PANEL =
  "z-hover-card-content pointer-events-none z-6 flex max-h-[calc(100dvh-16px)] w-88 flex-col gap-3 overflow-hidden p-4";

export const RunDetail = (props: { data: Data; hovered: Hovered }) => (
  <AnchoredPanel class={PANEL} cursorX={props.hovered.cursorX}>
    <div
      class="relative -mx-4 -mt-4 h-40 shrink-0 bg-cover bg-center"
      style={{
        "background-image": tileArt(
          props.hovered.entry.pgcrImage,
          props.hovered.entry.typeName,
        ),
      }}
    >
      <div class="absolute inset-x-0 bottom-0 flex flex-col bg-linear-to-t from-black/80 to-transparent px-4 pt-10 pb-3 text-shadow-art">
        <span class="text-base font-medium text-foreground">
          {props.hovered.entry.name}
        </span>
        <span class="text-foreground/70">{where(props.hovered.entry)}</span>
      </div>
    </div>
    <ActivityFacts
      entry={props.hovered.entry}
      values={props.data.values()}
      power={props.data.app.active()?.powerLevel}
    />
  </AnchoredPanel>
);
