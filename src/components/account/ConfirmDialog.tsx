"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Destructive confirmation (docs/07 §4.11): title names the object, body states the consequence,
 * the primary button carries the verb. `typeToConfirm` requires the word (e.g. "DELETE") before
 * the button enables (delete account).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  typeToConfirm,
  destructive = true,
  onConfirm,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  typeToConfirm?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = React.useState("");
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;
  return (
    <Dialog onOpenChange={(open) => !open && setTyped("")}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {typeToConfirm ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-word">
              Type <span className="font-mono">{typeToConfirm}</span> to confirm
            </Label>
            <Input
              id="confirm-word"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant={destructive ? "destructive" : "primary"}
              disabled={!ready}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
