import { Suspense } from "react";

import { LoginForm } from "@/components/account/LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-h2">Sign in</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
