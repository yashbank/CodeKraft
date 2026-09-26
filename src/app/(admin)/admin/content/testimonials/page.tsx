import { TestimonialsLogos } from "@/components/admin/content/TestimonialsLogos";
import {
  LOGOS,
  PRODUCTS,
  SITE_TESTIMONIALS,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminTestimonialsLogosPage() {
  return (
    <TestimonialsLogos
      testimonials={SITE_TESTIMONIALS}
      logos={LOGOS}
      products={PRODUCTS.map((p) => p.name)}
    />
  );
}
