import { ResetPasswordScreen } from "@/components/account/ResetPasswordScreen";
import { PreviewFrame, readState, type SearchParams } from "../_preview";

const STATES = ["request", "loading", "rate-limited", "sent", "set", "done", "invalid"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  const step = state === "loading" || state === "rate-limited" ? "request" : state;
  return (
    <PreviewFrame
      id="SCR-AUTH-04"
      title="Reset password"
      spec="ui/screens/user/SCR-AUTH-04-reset-password.md"
      href="/dev/screens/account/reset-password"
      states={STATES}
      current={state}
    >
      <ResetPasswordScreen
        step={step}
        email="pravin@iauro.com"
        loading={state === "loading"}
        error={state === "rate-limited" ? "Too many attempts. Try again in 12 minutes." : null}
      />
    </PreviewFrame>
  );
}
