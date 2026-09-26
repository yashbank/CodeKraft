/**
 * Provider registry (docs/06 §4.3, architecture §7.1).
 */
import { AppError, ErrorCode } from "@/lib/errors";
import type { PaymentMethodKey, PaymentProvider, ProviderRegistry } from "../provider";
import { manualProvider } from "./manual";

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly providersByMethod = new Map<PaymentMethodKey, PaymentProvider>();

  constructor() {
    this.register(manualProvider);
  }

  register(provider: PaymentProvider): void {
    for (const key of provider.keys) {
      this.providersByMethod.set(key, provider);
    }
  }

  get(method: PaymentMethodKey): PaymentProvider {
    const provider = this.providersByMethod.get(method);
    if (!provider) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Payment method '${method}' is not enabled or supported`,
      );
    }
    return provider;
  }

  has(method: PaymentMethodKey): boolean {
    return this.providersByMethod.has(method);
  }

  enabledMethods(): PaymentMethodKey[] {
    return Array.from(this.providersByMethod.keys());
  }
}

export const providerRegistry: ProviderRegistry = new DefaultProviderRegistry();
