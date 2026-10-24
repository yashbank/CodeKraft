import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Container } from "../Container";
import { Reveal } from "../Reveal";
import { SectionHeading } from "../SectionHeading";
import type { FaqItem } from "../types";

/**
 * BUG-037 — public homepage FAQ accordion. `getLandingContentQuery` already returns `faqs`;
 * this is the first place the landing page renders them. Empty rule: no faqs → render nothing,
 * not an empty accordion shell.
 */
export function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  if (faqs.length === 0) return null;

  return (
    <section aria-labelledby="faqs" className="border-t border-border py-16 lg:py-24">
      <Container size="narrow">
        <SectionHeading id="faqs" eyebrow="FAQ" title="Questions we hear a lot" />
        <Reveal className="mt-8">
          <Accordion type="multiple">
            {faqs.map((f) => (
              <AccordionItem key={f.id} value={f.id}>
                <AccordionTrigger>{f.question}</AccordionTrigger>
                <AccordionContent className="text-body">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  );
}
