import { ArrowRightIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Row, Section } from "./_section";

const VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
  "gradient",
] as const;

export function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="docs/08 §6.1 — variants × sizes × states. Hover to see accent-hover / glow; focus with Tab for the ring."
    >
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <Button variant={variant}>Default</Button>
          <Button variant={variant}>
            <ArrowRightIcon aria-hidden /> With icon
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading>
            Loading
          </Button>
        </Row>
      ))}
      <Row label="sizes">
        <Button size="sm">Small 32</Button>
        <Button size="md">Medium 40</Button>
        <Button size="lg">Large 48</Button>
        <Button size="xl">Extra large 56</Button>
      </Row>
      <Row label="icon sizes">
        <Button size="icon-sm" aria-label="Add (small)">
          <PlusIcon aria-hidden />
        </Button>
        <Button size="icon-md" variant="secondary" aria-label="Add (medium)">
          <PlusIcon aria-hidden />
        </Button>
        <Button size="icon-lg" variant="ghost" aria-label="Delete (large)">
          <Trash2Icon aria-hidden />
        </Button>
      </Row>
      <Row label="danger alias">
        <Button variant="danger">Revoke access</Button>
        <Button variant="danger" size="sm" loading>
          Revoking
        </Button>
      </Row>
    </Section>
  );
}
