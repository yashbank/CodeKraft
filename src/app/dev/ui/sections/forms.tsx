"use client";

import { CircleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupCard, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Row, Section } from "./_section";

export function FormsSection() {
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(true);

  return (
    <Section
      id="forms"
      title="Inputs and forms"
      description="docs/08 §6.2 — 40px controls (44px on touch), surface fill, fg-subtle placeholder, danger error state with icon + aria-describedby."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="f-default">Default</Label>
          <Input id="f-default" placeholder="Placeholder text" />
          <p className="text-caption text-fg-muted">Helper text sits 6px below.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-required" required>
            Required
          </Label>
          <Input id="f-required" required aria-required defaultValue="Filled value" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-error">With error</Label>
          <Input
            id="f-error"
            aria-invalid
            aria-describedby="f-error-msg"
            defaultValue="not-an-email"
            type="email"
          />
          <p id="f-error-msg" className="flex items-center gap-1.5 text-caption text-danger">
            <CircleAlertIcon aria-hidden className="size-4" /> Enter a valid email address.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-disabled">Disabled</Label>
          <Input id="f-disabled" disabled defaultValue="Cannot edit" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-readonly">Read-only</Label>
          <Input id="f-readonly" readOnly defaultValue="CK-ORD-000123" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-money">Money (mono, right-aligned)</Label>
          <Input
            id="f-money"
            inputMode="decimal"
            className="text-right font-mono tnum"
            defaultValue="4,999.00"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="f-textarea">Textarea (optional)</Label>
          <Textarea id="f-textarea" placeholder="Tell us about the project" />
        </div>
      </div>

      <Row label="select">
        <div className="space-y-2">
          <Label htmlFor="f-select">Purchase model</Label>
          <Select defaultValue="one_time">
            <SelectTrigger id="f-select" className="w-56">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Models</SelectLabel>
                <SelectItem value="one_time">One-time</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="custom_quote">Quote</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-select-sm">Small</Label>
          <Select>
            <SelectTrigger id="f-select-sm" size="sm" className="w-40">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-select-disabled">Disabled</Label>
          <Select disabled>
            <SelectTrigger id="f-select-disabled" className="w-40">
              <SelectValue placeholder="Disabled" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="x">x</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Row>

      <Row label="checkbox">
        <div className="flex items-center gap-2">
          <Checkbox id="cb-1" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          <Label htmlFor="cb-1">Checked (interactive)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="cb-2" />
          <Label htmlFor="cb-2">Unchecked</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="cb-3" checked="indeterminate" />
          <Label htmlFor="cb-3">Indeterminate</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="cb-4" disabled defaultChecked />
          <Label htmlFor="cb-4">Disabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="cb-5" aria-invalid />
          <Label htmlFor="cb-5">Error</Label>
        </div>
      </Row>

      <Row label="radio">
        <RadioGroup defaultValue="upi" aria-label="Payment method" className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="r-upi" value="upi" />
            <Label htmlFor="r-upi">UPI</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="r-bank" value="bank" />
            <Label htmlFor="r-bank">Bank transfer</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="r-card" value="card" disabled />
            <Label htmlFor="r-card">Card (disabled)</Label>
          </div>
        </RadioGroup>
      </Row>

      <Row label="radio cards">
        <RadioGroup defaultValue="starter" aria-label="Offering" className="w-full max-w-md">
          <RadioGroupCard value="starter">
            <span className="text-body font-semibold">Starter</span>
            <span className="text-caption text-fg-muted">One-time · Download · Lifetime</span>
          </RadioGroupCard>
          <RadioGroupCard value="pro">
            <span className="text-body font-semibold">Pro</span>
            <span className="text-caption text-fg-muted">Subscription · SaaS · Monthly</span>
          </RadioGroupCard>
        </RadioGroup>
      </Row>

      <Row label="switch">
        <div className="flex items-center gap-2">
          <Switch id="sw-1" checked={switched} onCheckedChange={setSwitched} />
          <Label htmlFor="sw-1">Reduce motion</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="sw-2" />
          <Label htmlFor="sw-2">Off</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="sw-3" size="sm" defaultChecked />
          <Label htmlFor="sw-3">Small</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="sw-4" disabled />
          <Label htmlFor="sw-4">Disabled</Label>
        </div>
      </Row>
    </Section>
  );
}
