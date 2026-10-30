/** Animated check shown inside a dialog after a create succeeds (P14-02). Motion is removed by the reduced-motion rules in tokens.css. */
export function SuccessMark({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      data-testid="success-mark"
      className="flex flex-col items-center gap-3 py-6 text-center"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="ck-success-pop size-14 rounded-full bg-success-soft p-3 text-success"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <p className="text-body font-semibold">{children}</p>
    </div>
  );
}
