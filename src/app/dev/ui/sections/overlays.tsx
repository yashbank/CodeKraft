"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Row, Section } from "./_section";

export function OverlaysSection() {
  return (
    <Section
      id="overlays"
      title="Overlays"
      description="docs/08 §6.9–§6.12 — dialog, sheet, popover, dropdown, tooltip, command, toast."
    >
      <Row label="dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm payment</DialogTitle>
              <DialogDescription>
                Approval-gated actions use this confirmation pattern.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Row>
      <Row label="sheet">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Start a project</SheetTitle>
              <SheetDescription>The landing inquiry sheet uses this container.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Row>
      <Row label="popover">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Popover</Button>
          </PopoverTrigger>
          <PopoverContent>Token-styled popover content.</PopoverContent>
        </Popover>
      </Row>
      <Row label="dropdown">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Order</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Confirm payment</DropdownMenuItem>
            <DropdownMenuItem>Issue invoice</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Cancel order</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
      <Row label="tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Row>
      <Row label="command">
        <Command className="w-full max-w-md rounded-md border border-border">
          <CommandInput placeholder="Search products…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Products">
              <CommandItem>FitDesk Pro</CommandItem>
              <CommandItem>TradeFlow</CommandItem>
              <CommandItem>MIS Portal</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </Row>
      <Row label="toast">
        <Button
          variant="outline"
          onClick={() => toast.success("Payment confirmed", { description: "CK-ORD-000001" })}
        >
          Success toast
        </Button>
        <Button variant="outline" onClick={() => toast.error("Reference not found")}>
          Error toast
        </Button>
      </Row>
    </Section>
  );
}
