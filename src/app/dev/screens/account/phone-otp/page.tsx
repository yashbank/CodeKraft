import { PhoneOtpScreen } from "@/components/account/PhoneOtpScreen";
import { PreviewFrame, readState, type SearchParams } from "../_preview";

const STATES = [
  "flag-off",
  "phone",
  "provider-error",
  "code",
  "code-wrong",
  "code-expired",
  "email",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  const step = state === "email" ? "email" : state.startsWith("code") ? "code" : "phone";
  const error =
    state === "code-wrong"
      ? "That code isn't right"
      : state === "code-expired"
        ? "Code expired — request a new one."
        : state === "provider-error"
          ? "We couldn't send the code — try email sign-in."
          : null;
  return (
    <PreviewFrame
      id="SCR-AUTH-05"
      title="Phone OTP"
      spec="ui/screens/user/SCR-AUTH-05-phone-otp.md"
      href="/dev/screens/account/phone-otp"
      states={STATES}
      current={state}
    >
      <PhoneOtpScreen
        enabled={state !== "flag-off"}
        step={step}
        error={error}
        attemptsLeft={state === "code-wrong" ? 2 : undefined}
      />
    </PreviewFrame>
  );
}
