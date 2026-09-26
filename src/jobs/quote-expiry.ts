/**
 * Quote expiry cron job (docs/06 §3.3 frequent endpoint, PHASE-04 P4.6).
 */
import { quotesService } from "@/modules/quotes/service";

export const quoteExpiryJob = {
  key: "quotes.expire" as const,
  async run(now: Date = new Date()) {
    const result = await quotesService.expireQuotes(now);
    return {
      expiredCount: result.expiredQuoteIds.length,
      expiredQuoteIds: result.expiredQuoteIds,
    };
  },
};
