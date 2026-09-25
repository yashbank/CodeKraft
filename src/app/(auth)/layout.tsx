export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="auth" className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
