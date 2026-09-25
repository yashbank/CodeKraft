import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = [
  "default",
  "renewal",
  "loading",
  "submitting",
  "duplicate",
  "unavailable",
  "unverified",
  "rate-limited",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-10"
      title="Checkout"
      spec="ui/screens/user/SCR-ACC-10-checkout.md"
      href="/dev/screens/account/checkout"
      states={STATES}
      current={state}
    >
      <PreviewShell
        minimal={{ backHref: "/products/storefront-kit", backLabel: "Back to product" }}
      >
        <p className="mb-4 text-caption text-fg-subtle">Try coupon code SAVE10.</p>
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}
