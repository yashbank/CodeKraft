/**
 * Provider registry (docs/06 §4.3): method key → provider. Release 1 registers `ManualProvider`
 * only; gateway providers are registered when their `provider_*` flag is on (V1.1). Enabled
 * methods = registered ∩ `site_settings.enabled_payment_methods` ∩ flags.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import {
  GATEWAY_METHOD_KEYS,
  type PaymentMethodKey,
  type PaymentProvider,
  type ProviderRegistry,
} from "../provider";

export interface RegistryOptions {
  /** Settings-driven enablement, evaluated at call time (defaults to "every registered method"). */
  isEnabled?: (method: PaymentMethodKey) => boolean;
}

export function createProviderRegistry(options: RegistryOptions = {}): ProviderRegistry {
  const providers = new Map<PaymentMethodKey, PaymentProvider>();
  const isEnabled = options.isEnabled ?? (() => true);
  return {
    register(provider) {
      for (const key of provider.keys) providers.set(key, provider);
    },
    has(method) {
      return providers.has(method) && isEnabled(method);
    },
    get(method) {
      const provider = providers.get(method);
      if (provider === undefined || !isEnabled(method)) {
        throw new AppError(ErrorCode.STATE_INVALID, `Payment method ${method} is not enabled.`);
      }
      return provider;
    },
    enabledMethods() {
      const order: PaymentMethodKey[] = ["manual_upi", "manual_bank", ...GATEWAY_METHOD_KEYS];
      return order.filter((m) => providers.has(m) && isEnabled(m));
    },
  };
}

export function isGatewayMethod(method: PaymentMethodKey): boolean {
  return (GATEWAY_METHOD_KEYS as readonly PaymentMethodKey[]).includes(method);
}
