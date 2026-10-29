import { toast } from "sonner";

/** How long the "Undo" toast stays up after a reversible destructive admin action. */
export const UNDO_MS = 6000;

/** Toast with an Undo button. `undo` returns an error message to surface, or nothing on success. */
export function undoToast(
  message: string,
  undo: () => Promise<string | void> | string | void,
  doneMessage = "Restored",
): void {
  toast.success(message, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () =>
        void Promise.resolve(undo()).then((err) =>
          err ? toast.error(err) : toast.success(doneMessage),
        ),
    },
  });
}
