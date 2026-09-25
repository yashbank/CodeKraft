import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";

import { beforeSend } from "@/lib/sentry";

describe("Sentry beforeSend scrubber (docs/12 §8.1, TM-23)", () => {
  it("strips cookies, auth headers, bodies and email addresses", () => {
    const event = {
      request: {
        cookies: { s: "1" },
        data: { password: "x" },
        headers: { Authorization: "Bearer t", "User-Agent": "ua", Cookie: "a=b" },
        query_string: "email=pravin@iauro.com",
      },
      user: { id: "u1", email: "pravin@iauro.com", ip_address: "1.2.3.4" },
      message: "failed for pravin@iauro.com",
      exception: { values: [{ type: "Error", value: "user pravin@iauro.com not found" }] },
      extra: { licenseKey: "ABC", nested: { token: "t", note: "mail me at a@b.co" } },
      breadcrumbs: [{ message: "sent to a@b.co", data: { cookie: "x" } }],
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {})!;
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.headers?.Authorization).toBe("[redacted]");
    expect(out.request?.headers?.Cookie).toBe("[redacted]");
    expect(out.request?.headers?.["User-Agent"]).toBe("ua");
    expect(out.request?.query_string).not.toContain("@");
    expect(out.user).toEqual({ id: "u1" });
    expect(out.message).toBe("failed for [email]");
    expect(out.exception?.values?.[0]?.value).toBe("user [email] not found");
    expect(out.extra?.licenseKey).toBe("[redacted]");
    expect((out.extra?.nested as { token: string; note: string }).token).toBe("[redacted]");
    expect((out.extra?.nested as { note: string }).note).toBe("mail me at [email]");
    expect(out.breadcrumbs?.[0]?.message).toBe("sent to [email]");
    expect(out.breadcrumbs?.[0]?.data?.cookie).toBe("[redacted]");
    expect(JSON.stringify(out)).not.toMatch(/@/);
  });
});
