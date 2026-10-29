/** Client-safe half of the admin "New order" poll (no db imports). */
export interface NewOrderAlerts {
  serverTime: string;
  count: number;
  latest: Array<{ id: string; orderNo: string }>;
}

/** Toast copy: one order is named, several are counted. */
export function orderAlertText(a: Pick<NewOrderAlerts, "count" | "latest">): string {
  if (a.count === 1 && a.latest[0]) return `New order #${a.latest[0].orderNo}`;
  return `${a.count} new orders`;
}
