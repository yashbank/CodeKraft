"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/modules/auth/client";

/** Minimal working sign-in (P1.7 gate). The designed screen SCR-AUTH-01 replaces the visuals in P7. */
export function LoginForm({ defaultNext = "/account" }: { defaultNext?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? defaultNext;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const res = await authClient.signIn.email({
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
          });
          if (res.error) {
            setError(res.error.message ?? "Invalid email or password.");
            return;
          }
          router.push(next);
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
