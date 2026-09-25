import { RegisterScreen, type RegisterState } from "@/components/account/RegisterScreen";
import { PreviewFrame, readState, type SearchParams } from "../_preview";

const STATES = ["default", "loading", "error", "turnstile", "sent", "phone-flag"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-AUTH-02"
      title="Register"
      spec="ui/screens/user/SCR-AUTH-02-register.md"
      href="/dev/screens/account/register"
      states={STATES}
      current={state}
    >
      <RegisterScreen
        state={state === "phone-flag" ? "default" : (state as RegisterState)}
        sentTo="pravin@iauro.com"
        phoneOtpEnabled={state === "phone-flag"}
      />
    </PreviewFrame>
  );
}
