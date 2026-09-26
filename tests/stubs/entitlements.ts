/**
 * Entitlements stub for Phase 4 service-level integration scenarios.
 */
export const entitlementsStub = {
  grantedOrders: [] as string[],
  revokedOrders: [] as string[],
  async grantForOrder(orderId: string) {
    this.grantedOrders.push(orderId);
  },
  async revokeForOrder(orderId: string) {
    this.revokedOrders.push(orderId);
  },
  reset() {
    this.grantedOrders = [];
    this.revokedOrders = [];
  },
};
