import { AdminLoginScreen } from "@/components/account/AdminLoginScreen";
import { LoginScreen, type LoginReason } from "@/components/account/LoginScreen";
import { PreviewFrame, readState, type SearchParams } from "../_preview";

const STATES = [
  "default",
  "error",
  "loading",
  "suspended",
  "replaced",
  "expired",
  "verify",
  "phone-flag",
  "admin",
  "admin-totp",
  "admin-error",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  const reason = (["suspended", "replaced", "expired", "verify"] as const).includes(
    state as LoginReason,
  )
    ? (state as LoginReason)
    : undefined;
  return (
    <PreviewFrame
      id="SCR-AUTH-01"
      title="Login"
      spec="ui/screens/user/SCR-AUTH-01-login.md"
      href="/dev/screens/account/login"
      states={STATES}
      current={state}
    >
      {state.startsWith("admin") ? (
        <AdminLoginScreen
          step={state === "admin-totp" || state === "admin-error" ? "totp" : "credentials"}
          error={state === "admin-error" ? "That code isn't right — 2 attempts left." : null}
        />
      ) : (
        <LoginScreen
          reason={reason}
          initialError={state === "error" ? "Email or password is incorrect." : null}
          forceLoading={state === "loading"}
          phoneOtpEnabled={state === "phone-flag"}
          registerHref="/dev/screens/account/register"
          resetHref="/dev/screens/account/reset-password"
          otpHref="/dev/screens/account/phone-otp?state=phone"
        />
      )}
    </PreviewFrame>
  );
}
