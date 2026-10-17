import { For, Show } from "solid-js";

import {
  applyTag,
  dismissTag,
  pendingTag,
  replacedBy,
} from "../core/items/tagConfirm.ts";
import { tagDefs } from "../core/items/tags.ts";
import { plural } from "../core/text.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import {
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./lib/zaidan/alert-dialog.tsx";
import { NameCounts } from "./NameCounts.tsx";
import { TagDot } from "./TagDot.tsx";

/** The confirm behind requestTag, mounted once */
export const TagConfirm = () => {
  const tagLabel = (tagId: string | undefined) =>
    tagDefs().find((def) => def.id === tagId)?.label;

  const confirm = () => {
    const request = pendingTag();

    if (request) {
      applyTag(request);
    }

    dismissTag();
  };

  return (
    <ConfirmDialog
      value={pendingTag()}
      onClose={dismissTag}
      action={tagLabel(pendingTag()?.tagId) ? "Tag" : "Clear"}
      onAction={confirm}
    >
      {(request) => (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tagLabel(request().tagId)
                ? `Tag ${plural(request().items.length, "item")} as ${tagLabel(request().tagId)}?`
                : `Clear the tag on ${plural(request().items.length, "item")}?`}
            </AlertDialogTitle>
            <AlertDialogDescription as="div" class="w-full">
              <NameCounts
                items={request().items}
                class="max-h-60 overflow-y-auto text-left text-foreground"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Show when={replacedBy(request()).length > 0}>
            <div class="flex flex-col gap-1.5 text-sm">
              <span class="text-muted-foreground">
                {tagLabel(request().tagId) ? "Replaces" : "Removes"}
              </span>
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                <For each={replacedBy(request())}>
                  {(one) => (
                    <span class="flex items-center gap-1.5">
                      <TagDot color={one.color} />
                      {one.label}
                      <span class="text-muted-foreground tabular-nums">
                        {one.count}
                      </span>
                    </span>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </>
      )}
    </ConfirmDialog>
  );
};
