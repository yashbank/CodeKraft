"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createCustomer } from "@/modules/users/admin-mutations";
import { Field } from "../RichTextField";

export interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the account is created (email may still have failed to send). */
  onCreated: (customer: { id: string; name: string; email: string }) => void;
  initial?: { email?: string; name?: string };
}

/** BUG-066: admin creates a customer; the customer sets their own password via emailed link. */
export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
  initial,
}: NewCustomerDialogProps) {
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail(initial?.email ?? "");
      setName(initial?.name ?? "");
      setError(null);
    }
  }, [open, initial?.email, initial?.name]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // React bubbles portal events to an enclosing form
    setSubmitting(true);
    setError(null);
    const result = await createCustomer({
      email: email.trim(),
      name: name.trim(),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(company.trim() ? { company: company.trim() } : {}),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const d = result.data;
    if (d.emailSent) toast.success(`Customer created. Set-password link sent to ${d.email}`);
    else
      toast.warning("Customer created but the email failed. Use Send reset link on the customer.");
    onCreated({ id: d.userId, name: d.name, email: d.email });
    setPhone("");
    setCompany("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>
              The customer receives an email to set their own password.
            </DialogDescription>
          </DialogHeader>
          <Field id="nc-name" label="Name" required>
            <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field id="nc-email" label="Email" required error={error ?? undefined}>
            <Input
              id="nc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field id="nc-phone" label="Phone" optional>
            <Input id="nc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field id="nc-company" label="Company" optional>
            <Input id="nc-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
