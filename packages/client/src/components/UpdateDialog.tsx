import { closeUpdate, pendingUpdate } from "../core/update.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import {
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./lib/zaidan/alert-dialog.tsx";

export const UpdateDialog = () => (
  <ConfirmDialog
    value={pendingUpdate()}
    onClose={closeUpdate}
    action="Reload"
    onAction={() => window.location.reload()}
  >
    {() => (
      <AlertDialogHeader>
        <AlertDialogTitle>Update available</AlertDialogTitle>
        <AlertDialogDescription>
          Reload to get the latest version.
        </AlertDialogDescription>
      </AlertDialogHeader>
    )}
  </ConfirmDialog>
);
