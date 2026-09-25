import { VerifyEmailScreen } from "@/components/account/VerifyEmailScreen";
import { PreviewFrame, readState, type SearchParams } from "../_preview";

const STATES = [
  "pending",
  "verifying",
  "verified",
  "verified-visitor",
  "expired",
  "expired-visitor",
  "embedded",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  const base = state.replace("-visitor", "") as
    "pending" | "verifying" | "verified" | "expired" | "embedded";
  return (
    <PreviewFrame
      id="SCR-AUTH-03"
      title="Verify email"
      spec="ui/screens/user/SCR-AUTH-03-verify-email.md"
      href="/dev/screens/account/verify-email"
      states={STATES}
      current={state}
    >
      {base === "embedded" ? (
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="mb-4 text-body-sm text-fg-muted">
            Interstitial variant rendered inside checkout / chat:
          </p>
          <VerifyEmailScreen state="pending" email="pravin@iauro.com" embedded />
        </div>
      ) : (
        <VerifyEmailScreen
          state={base}
          email="pravin@iauro.com"
          signedIn={!state.endsWith("-visitor")}
          continueHref="/dev/screens/account/overview"
        />
      )}
    </PreviewFrame>
  );
}
