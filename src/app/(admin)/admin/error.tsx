"use client";

import { ErrorPanel } from "@/components/site/ErrorPanel";

/** Admin 500 boundary: inside the admin shell, no stack trace (P14-12b). */
export default function AdminError({
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
      body="This admin page couldn't load. It has been logged."
      digest={error.digest}
      onRetry={reset}
      links={[{ href: "/admin/dashboard", label: "Back to dashboard" }]}
    />
  );
}
