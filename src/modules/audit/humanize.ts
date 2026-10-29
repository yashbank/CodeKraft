/**
 * Audit action codes -> timeline text. Actions look like "API-ADM-08 customer.suspend",
 * "payment.confirmed" or "order.status_changed"; the API-xxx-NN prefix is an internal id.
 */
export function humanizeAction(action: string): string {
  const s = action
    .replace(/^API-[A-Z]+-\d+\s+/, "")
    .replace(/[._]+/g, " ")
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : action;
}
