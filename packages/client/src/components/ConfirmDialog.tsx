import { Show, type Accessor, type JSX } from "solid-js";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
} from "./lib/zaidan/alert-dialog.tsx";

interface Props<T> {
  value: T | undefined;
  onClose: () => void;
  action: string;
  disabled?: boolean;
  onAction: () => void;
  children: (value: Accessor<NonNullable<T>>) => JSX.Element;
}

/** An alert dialog open while value is set, with Cancel and one action */
export const ConfirmDialog = <T,>(props: Props<T>) => (
  <AlertDialog
    open={props.value !== undefined}
    onOpenChange={(open) => {
      if (!open) {
        props.onClose();
      }
    }}
  >
    <Show when={props.value}>
      {(value) => (
        <AlertDialogContent>
          {props.children(value)}
          <AlertDialogFooter>
            <AlertDialogCancel aria-label="Cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={props.disabled}
              onClick={props.onAction}
            >
              {props.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </Show>
  </AlertDialog>
);
