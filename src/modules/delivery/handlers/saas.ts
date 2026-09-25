/** `saas` — `active` on grant, `provisioning_state` tracked separately (MASTER_SPEC §7 "Order fulfilled"). */
import { createProvisionedHandler } from "./provisioned";

export const saasHandler = createProvisionedHandler("saas", "active");
