"use client";

import { ErrorPanel } from "@/components/site/ErrorPanel";

/** Account 500 boundary: inside the account shell, no error details (P14-12b). */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPanel
      code="500"
      title="Something went wrong"
      body="This page couldn't load. It has been logged. Try again, or go back to your account."
      digest={error.digest}
      onRetry={reset}
      links={[
        { href: "/account", label: "Account home" },
        { href: "/contact", label: "Contact us" },
      ]}
    />
  );
}
