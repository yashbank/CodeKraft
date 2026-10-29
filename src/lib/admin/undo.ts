import { toast } from "sonner";

/** How long the "Undo" toast stays up after a reversible destructive admin action. */
export const UNDO_MS = 6000;

/** Toast with an Undo button. `undo` may return an error message (string) to surface instead. */
export function undoToast(message: string, undo: () => unknown, doneMessage = "Restored"): void {
  toast.success(message, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () =>
        void Promise.resolve(undo()).then((err) =>
          typeof err === "string" && err ? toast.error(err) : toast.success(doneMessage),
        ),
    },
  });
}
