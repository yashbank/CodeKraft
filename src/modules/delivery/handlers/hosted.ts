/** `hosted` — `pending` until `completeProvisioning` (docs/03 §3.4, API-DEL-07). */
import { createProvisionedHandler } from "./provisioned";

export const hostedHandler = createProvisionedHandler("hosted", "pending");
