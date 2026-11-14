"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { issueFormGuardToken } from "@/lib/form-guard-action";

export const HONEYPOT_NAME = "website_url";
const MIN_FILL_MS = 2000;

/**
 * Hidden bot trap. Visually hidden off-screen (not display:none, so naive bots still fill it),
 * aria-hidden, not tabbable, autocomplete off. Real users never see or reach it.
 */
export const HoneypotField = forwardRef<HTMLInputElement>(function HoneypotField(_, ref) {
  return (
    <div
      aria-hidden="true"
      data-slot="hp"
      style={{
        position: "absolute",
        left: "-10000px",
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label>
        Leave this field empty
        <input
          ref={ref}
          type="text"
          name={HONEYPOT_NAME}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </label>
    </div>
  );
});

/**
 * Fetches the server-signed render timestamp on mount. `getToken` retries if the mount fetch
 * failed, waiting out the time trap so a real user is never dropped by the retry itself.
 */
export function useFormGuardToken() {
  const tokenRef = useRef<string | null>(null);
  const [, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    issueFormGuardToken()
      .then((t) => {
        tokenRef.current = t;
        if (live) setReady(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  async function getToken(): Promise<string | null> {
    if (tokenRef.current) return tokenRef.current;
    try {
      const t = await issueFormGuardToken();
      await new Promise((r) => setTimeout(r, MIN_FILL_MS + 100));
      tokenRef.current = t;
      return t;
    } catch {
      return null;
    }
  }
  return { getToken };
}
