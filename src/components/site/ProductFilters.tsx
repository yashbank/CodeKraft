"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/_utils";

import { DELIVERY_LABEL, PURCHASE_MODEL_LABEL } from "./_format";
import type { DeliveryType, PurchaseModel } from "./types";

export interface CategoryNode {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
}

export interface ProductFilterState {
  categories: string[];
  /** Whole rupees (display currency), inclusive. */
  priceMin?: number;
  priceMax?: number;
  models: PurchaseModel[];
  deliveries: DeliveryType[];
  tech: string[];
  industries: string[];
  audiences: string[];
}

export const EMPTY_FILTERS: ProductFilterState = {
  categories: [],
  models: [],
  deliveries: [],
  tech: [],
  industries: [],
  audiences: [],
};

export function countActiveFilters(f: ProductFilterState): number {
  return (
    f.categories.length +
    f.models.length +
    f.deliveries.length +
    f.tech.length +
    f.industries.length +
    f.audiences.length +
    (f.priceMin !== undefined || f.priceMax !== undefined ? 1 : 0)
  );
}

const MODELS: PurchaseModel[] = ["one_time", "subscription", "custom_quote"];
const DELIVERIES: DeliveryType[] = ["saas", "download", "license", "service", "custom"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Filter panel — SCR-SITE-03 `<aside aria-label="Filters">`: accordion groups for category
 * (two-level tree), price (min/max inputs; the dual slider is a P7 primitive), purchase model,
 * delivery type, tech stack, industry and audience. Controlled: the page owns the state and
 * (in P7) mirrors it to the URL.
 */
export function ProductFilters({
  value,
  onChange,
  categories,
  techOptions,
  industryOptions,
  audienceOptions,
  currencySymbol = "₹",
  className,
}: {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  categories: CategoryNode[];
  techOptions: string[];
  industryOptions: string[];
  audienceOptions: string[];
  currencySymbol?: string;
  className?: string;
}) {
  const active = countActiveFilters(value);
  const set = (patch: Partial<ProductFilterState>) => onChange({ ...value, ...patch });

  return (
    <aside aria-label="Filters" className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-h4">Filters</h2>
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={active === 0}
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Clear all{active > 0 ? ` (${String(active)})` : ""}
        </Button>
      </div>
      <Accordion type="multiple" defaultValue={["category", "price", "model", "delivery"]}>
        <AccordionItem value="category">
          <AccordionTrigger>Category</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {categories.map((c) => (
                <li key={c.slug} className="space-y-2">
                  <CheckRow
                    id={`cat-${c.slug}`}
                    label={c.name}
                    checked={value.categories.includes(c.slug)}
                    onCheckedChange={() => set({ categories: toggle(value.categories, c.slug) })}
                  />
                  {c.children.length > 0 ? (
                    <ul className="space-y-2 pl-6">
                      {c.children.map((ch) => (
                        <li key={ch.slug}>
                          <CheckRow
                            id={`cat-${ch.slug}`}
                            label={ch.name}
                            checked={value.categories.includes(ch.slug)}
                            onCheckedChange={() =>
                              set({ categories: toggle(value.categories, ch.slug) })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <AccordionTrigger>Price</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price-min">Min ({currencySymbol})</Label>
                <Input
                  id="price-min"
                  inputMode="numeric"
                  className="tnum"
                  placeholder="0"
                  value={value.priceMin ?? ""}
                  onChange={(e) =>
                    set({
                      priceMin: e.target.value === "" ? undefined : Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-max">Max ({currencySymbol})</Label>
                <Input
                  id="price-max"
                  inputMode="numeric"
                  className="tnum"
                  placeholder="Any"
                  value={value.priceMax ?? ""}
                  onChange={(e) =>
                    set({
                      priceMax: e.target.value === "" ? undefined : Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-caption text-fg-subtle">Dual-handle slider lands in P7.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="model">
          <AccordionTrigger>Purchase model</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {MODELS.map((m) => (
                <li key={m}>
                  <CheckRow
                    id={`model-${m}`}
                    label={m === "one_time" ? "One-time" : PURCHASE_MODEL_LABEL[m]}
                    checked={value.models.includes(m)}
                    onCheckedChange={() => set({ models: toggle(value.models, m) })}
                  />
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="delivery">
          <AccordionTrigger>Delivery type</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {DELIVERIES.map((d) => (
                <li key={d}>
                  <CheckRow
                    id={`delivery-${d}`}
                    label={DELIVERY_LABEL[d]}
                    checked={value.deliveries.includes(d)}
                    onCheckedChange={() => set({ deliveries: toggle(value.deliveries, d) })}
                  />
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <FacetGroup
          id="tech"
          title="Tech stack"
          options={techOptions}
          selected={value.tech}
          onToggle={(v) => set({ tech: toggle(value.tech, v) })}
        />
        <FacetGroup
          id="industry"
          title="Industry"
          options={industryOptions}
          selected={value.industries}
          onToggle={(v) => set({ industries: toggle(value.industries, v) })}
        />
        <FacetGroup
          id="audience"
          title="Target audience"
          options={audienceOptions}
          selected={value.audiences}
          onToggle={(v) => set({ audiences: toggle(value.audiences, v) })}
        />
      </Accordion>
    </aside>
  );
}

function FacetGroup({
  id,
  title,
  options,
  selected,
  onToggle,
}: {
  id: string;
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <AccordionItem value={id}>
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o}>
              <CheckRow
                id={`${id}-${o}`}
                label={o}
                checked={selected.includes(o)}
                onCheckedChange={() => onToggle(o)}
              />
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

function CheckRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="cursor-pointer font-normal text-fg">
        {label}
      </Label>
    </div>
  );
}
