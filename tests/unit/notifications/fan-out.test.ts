import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "@/modules/notifications/types";
import { renderNotification } from "@/modules/notifications/templates";

describe("Notifications Unit: Fan-Out & Templates", () => {
  it("renders all defined notification types without error", () => {
    for (const type of NOTIFICATION_TYPES) {
      const rendered = renderNotification(type, {
        orderId: "order-123",
        orderNumber: "CK-1001",
        leadId: "lead-123",
        productTitle: "Test Product",
      });

      expect(rendered.title).toBeDefined();
      expect(typeof rendered.title).toBe("string");
      expect(rendered.title.length).toBeGreaterThan(0);
      expect(typeof rendered.emailPriority).toBe("number");
    }
  });

  it("ensures admin-only notifications do not have customer email templates (except overdue digest)", () => {
    const adminTypes = [
      "delivery.task",
      "approval.requested",
      "lead.new",
      "lead.assigned",
      "chat.cap_reached",
      "system.job_failed",
    ] as const;

    for (const type of adminTypes) {
      const rendered = renderNotification(type, {});
      expect(rendered.emailTemplate).toBeNull();
    }

    const digest = renderNotification("lead.overdue_digest", { overdueCount: 3 });
    expect(digest.emailTemplate).toBe("admin-overdue-digest");
  });
});
