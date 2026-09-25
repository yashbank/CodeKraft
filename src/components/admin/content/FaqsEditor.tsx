"use client";

import * as React from "react";
import { BotIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banner } from "../Banner";
import { DataToolbar } from "../DataToolbar";
import { Field, RichTextField } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { FaqItem } from "../types";
import { ContentEditorFrame, moveItem, SortableRow } from "./ContentEditorFrame";

const CONTACT_RE = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{8,}\d/;

/** SCR-ADM-27 — FAQs with three scopes (site / chatbot-only / product), sortable list, editor sheet and a contact-detail lint. */
export function FaqsEditor({ faqs: initial, products }: { faqs: FaqItem[]; products: string[] }) {
  const [scope, setScope] = React.useState<FaqItem["scope"]>("site");
  const [faqs, setFaqs] = React.useState(initial);
  const [editing, setEditing] = React.useState<FaqItem | "new" | null>(null);
  const [answer, setAnswer] = React.useState("");
  const list = faqs.filter((f) => f.scope === scope);
  const f = editing && editing !== "new" ? editing : null;
  const lint = CONTACT_RE.test(answer);

  return (
    <ContentEditorFrame
      title="FAQs"
      description="Site FAQs appear publicly; Chatbot-only FAQs are used to answer questions but never shown as a list. Product FAQs are edited per product."
      headerActions={
        <Button
          size="sm"
          onClick={() => {
            setEditing("new");
            setAnswer("");
          }}
        >
          <PlusIcon aria-hidden /> Add FAQ
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as FaqItem["scope"])}>
          <TabsList>
            <TabsTrigger value="site">Site</TabsTrigger>
            <TabsTrigger value="chatbot">Chatbot-only</TabsTrigger>
            <TabsTrigger value="product">Product</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <DataToolbar searchId="faq-search" searchPlaceholder="Search questions…" />
      {list.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No FAQs in this scope</p>
      ) : null}
      <ol className="space-y-2" aria-label="FAQs">
        {list.map((item, i) => (
          <SortableRow
            key={item.id}
            index={i}
            total={list.length}
            label={item.question}
            onMove={(from, to) =>
              setFaqs((all) => {
                const ids = list.map((x) => x.id);
                const moved = moveItem(ids, from, to);
                return [
                  ...all.filter((x) => x.scope !== scope),
                  ...moved
                    .map((id) => all.find((x) => x.id === id))
                    .filter((x): x is FaqItem => Boolean(x)),
                ];
              })
            }
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">{item.question}</p>
                <p className="line-clamp-2 text-caption text-fg-muted">{item.answer}</p>
                <p className="mt-1 flex gap-1">
                  <StatusBadge kind="faqs.scope" value={item.scope} size="sm" />
                  {item.product ? (
                    <Badge tone="ghost" size="sm">
                      {item.product}
                    </Badge>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={`faq-pub-${item.id}`}
                  size="sm"
                  defaultChecked={item.published}
                  aria-label={`Published: ${item.question}`}
                  disabled={scope === "product"}
                />
                <RowActions
                  label={`Actions for ${item.question}`}
                  actions={[
                    {
                      label: "Edit",
                      onSelect: () => {
                        setEditing(item);
                        setAnswer(item.answer);
                      },
                      disabled: scope === "product",
                    },
                    { label: "Duplicate to another scope" },
                    {
                      label: "Delete",
                      destructive: true,
                      separatorBefore: true,
                      disabled: scope === "product",
                    },
                  ]}
                />
              </div>
            </div>
          </SortableRow>
        ))}
      </ol>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="overflow-y-auto lg:w-[640px] tv:w-[760px]">
          <SheetHeader>
            <SheetTitle>{f ? "Edit FAQ" : "New FAQ"}</SheetTitle>
            <SheetDescription>Saving triggers a debounced knowledge re-index.</SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="faq-q" label="Question" required hint="200 chars">
              <Input id="faq-q" maxLength={200} defaultValue={f?.question} />
            </Field>
            <div className="space-y-1.5">
              <Label htmlFor="faq-a" required>
                Answer
              </Label>
              <RichTextField
                id="faq-a-rich"
                label="Answer (formatting)"
                rows={1}
                className="sr-only"
              />
              <textarea
                id="faq-a"
                rows={5}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body text-fg focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              {lint ? (
                <Banner tone="warning" role="status">
                  Looks like an email or phone number — answers must not include contact details
                  (D-808). Non-blocking.
                </Banner>
              ) : null}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Scope</legend>
              <RadioGroup defaultValue={f?.scope ?? scope} className="flex flex-wrap gap-6">
                {(["site", "chatbot", "product"] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <RadioGroupItem id={`faq-scope-${s}`} value={s} />
                    <Label htmlFor={`faq-scope-${s}`}>
                      {s === "chatbot" ? "Chatbot only" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
            <Field id="faq-product" label="Product" optional>
              <Select defaultValue={f?.product}>
                <SelectTrigger id="faq-product">
                  <SelectValue placeholder="Product scope only" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="faq-pub" defaultChecked={f?.published ?? true} />
              <Label htmlFor="faq-pub">Published</Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                toast("Dry run: this FAQ was retrieved at rank 1 for the test question")
              }
            >
              <BotIcon aria-hidden /> Test with assistant
            </Button>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("FAQ saved — assistant index updating");
                setEditing(null);
              }}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentEditorFrame>
  );
}
