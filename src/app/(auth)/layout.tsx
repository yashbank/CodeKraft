import { Toaster } from "@/components/ui/sonner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="auth">
      {children}
      {/* R8-08: resend-verification feedback toasts on /auth/register and /auth/verify. */}
      <Toaster />
    </div>
  );
}
