"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { FaqItem } from "../types";
import { ContentEditorFrame, moveItem, SortableRow } from "./ContentEditorFrame";
import { fromPlainText } from "@/modules/content/render";
import { removeFaq, reorderFaqsList, saveFaq } from "@/modules/content/admin-mutations";

const CONTACT_RE = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{8,}\d/;

/** SCR-ADM-27 — FAQs with three scopes (site / chatbot-only / product), sortable list, editor sheet and a contact-detail lint. */
export function FaqsEditor({ faqs: initial, products }: { faqs: FaqItem[]; products: string[] }) {
  const router = useRouter();
  void products;
  const [scope, setScope] = React.useState<FaqItem["scope"]>("site");
  const [faqs, setFaqs] = React.useState(initial);
  const [editing, setEditing] = React.useState<FaqItem | "new" | null>(null);
  const [answer, setAnswer] = React.useState("");
  const [faqScope, setFaqScope] = React.useState<FaqItem["scope"]>("site");
  const [published, setPublished] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const list = faqs.filter((x) => x.scope === scope);
  const f = editing && editing !== "new" ? editing : null;
  const lint = CONTACT_RE.test(answer);

  function openEdit(item: FaqItem | "new") {
    setEditing(item);
    const row = item === "new" ? null : item;
    setAnswer(row?.answer ?? "");
    setFaqScope(row?.scope ?? scope);
    setPublished(row?.published ?? true);
  }

  async function handleSave() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    setSaving(true);
    const result = await saveFaq({
      id: f?.id,
      question: String(data.get("question") ?? "").trim(),
      answerJson: fromPlainText(answer),
      scope: faqScope,
      position: faqs.filter((x) => x.scope === faqScope).length,
      published,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("FAQ saved");
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(item: FaqItem) {
    const result = await removeFaq({ id: item.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setFaqs((all) => all.filter((x) => x.id !== item.id));
    toast.success("FAQ deleted");
    router.refresh();
  }

  async function persistOrder(ids: string[]) {
    setFaqs((all) => [
      ...all.filter((x) => x.scope !== scope),
      ...ids.map((id) => all.find((x) => x.id === id)).filter((x): x is FaqItem => Boolean(x)),
    ]);
    const result = await reorderFaqsList({ ids });
    if (!result.ok) toast.error(result.error.message);
    else router.refresh();
  }

  return (
    <ContentEditorFrame
      title="FAQs"
      description="Site FAQs appear publicly; Chatbot-only FAQs are used to answer questions but never shown as a list. Product FAQs are edited per product."
      hideSaveBar
      headerActions={
        <Button size="sm" onClick={() => openEdit("new")}>
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
              persistOrder(
                moveItem(
                  list.map((x) => x.id),
                  from,
                  to,
                ),
              )
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
                  checked={item.published}
                  disabled={scope === "product"}
                  onCheckedChange={async (v) => {
                    setFaqs((all) =>
                      all.map((x) => (x.id === item.id ? { ...x, published: v } : x)),
                    );
                    const result = await saveFaq({
                      id: item.id,
                      question: item.question,
                      answerJson: fromPlainText(item.answer),
                      scope: item.scope,
                      position: i,
                      published: v,
                    });
                    if (!result.ok) {
                      toast.error(result.error.message);
                      setFaqs((all) =>
                        all.map((x) => (x.id === item.id ? { ...x, published: !v } : x)),
                      );
                    } else {
                      router.refresh();
                    }
                  }}
                  aria-label={`Published: ${item.question}`}
                />
                <RowActions
                  label={`Actions for ${item.question}`}
                  actions={[
                    {
                      label: "Edit",
                      onSelect: () => openEdit(item),
                      disabled: scope === "product",
                    },
                    {
                      label: "Delete",
                      destructive: true,
                      separatorBefore: true,
                      disabled: scope === "product",
                      onSelect: () => handleDelete(item),
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
          <form
            ref={formRef}
            className="space-y-4 px-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Field id="faq-q" label="Question" required hint="300 chars">
              <Input
                id="faq-q"
                name="question"
                maxLength={300}
                defaultValue={f?.question}
                required
              />
            </Field>
            <div className="space-y-1.5">
              <Label htmlFor="faq-a" required>
                Answer
              </Label>
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
              <RadioGroup
                value={faqScope}
                onValueChange={(v) => setFaqScope(v as FaqItem["scope"])}
                className="flex flex-wrap gap-6"
              >
                {(["site", "chatbot"] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <RadioGroupItem id={`faq-scope-${s}`} value={s} />
                    <Label htmlFor={`faq-scope-${s}`}>
                      {s === "chatbot" ? "Chatbot only" : "Site"}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-caption text-fg-muted">
                Product-scoped FAQs are created from the product editor.
              </p>
            </fieldset>
            <div className="flex items-center gap-2">
              <Switch id="faq-pub" checked={published} onCheckedChange={setPublished} />
              <Label htmlFor="faq-pub">Published</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentEditorFrame>
  );
}
