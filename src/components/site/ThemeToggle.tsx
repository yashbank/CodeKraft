/**
 * Theme toggle placeholder (docs/07 §4.2). Release 1 ships a single theme and no persistence, so a
 * button here would do nothing (dead control): render nothing until P7 wires the cookie/user-pref
 * switch. The props-only shell stays so header/footer layouts keep their slot.
 */
export function ThemeToggle(_props: { enabled?: boolean }) {
  return null;
}
