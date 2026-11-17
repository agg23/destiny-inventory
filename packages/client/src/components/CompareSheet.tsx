import * as DialogPrimitive from "@kobalte/core/dialog";

import { useApp } from "../core/app/state.ts";
import { plural } from "../core/text.ts";
import { Compare } from "./Compare.tsx";
import { IconButton } from "./lib/IconButton.tsx";
import { HEADING } from "./lib/text.ts";
import { Dialog, DialogOverlay, DialogPortal } from "./lib/zaidan/dialog.tsx";
import { X } from "./lib/zaidan/icons.tsx";

export const CompareSheet = () => {
  const app = useApp();

  return (
    <Dialog
      open={app.compared().length > 0}
      onOpenChange={(open) => {
        if (!open) {
          app.onCloseCompare();
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay data-compare />
        <DialogPrimitive.Content
          class="compare-sheet fixed top-(--header-h,49px) bottom-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col rounded-b-lg border border-t-0 bg-card shadow-[0_12px_30px_#0009] outline-none"
          data-compare
        >
          <div class="flex items-center gap-2 border-b px-4 py-2">
            <DialogPrimitive.Title class={`${HEADING} mr-auto`}>
              Comparing {plural(app.compared().length, "item")}
            </DialogPrimitive.Title>
            <IconButton
              type="button"
              size="icon-xs"
              label="Close"
              onClick={app.onCloseCompare}
            >
              <X />
            </IconButton>
          </div>
          <Compare
            items={app.compared()}
            onUnpin={app.onUnpin}
            column="calc(var(--item-run) + var(--space-6))"
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};
