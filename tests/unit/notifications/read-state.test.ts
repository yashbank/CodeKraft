import { describe, expect, it } from "vitest";
import { mapNotificationItem as mapAccount } from "@/lib/account/notifications-view";
import { mapNotificationItem as mapAdmin } from "@/lib/admin/notifications-view";
import { applyRead, countUnread } from "@/lib/notifications/read-state";
import type { NotificationItem, NotificationType } from "@/modules/notifications/types";

const row = (
  id: string,
  type: NotificationType,
  readAt: string | null = null,
): NotificationItem => ({
  id,
  type,
  title: id,
  body: null,
  link: null,
  payload: null,
  readAt,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("notification read state", () => {
  it("admin and account views derive the same read flag, so counts agree", () => {
    const rows = [row("a", "query.new"), row("b", "lead.new", "2026-01-02T00:00:00.000Z")];
    expect(countUnread(rows.map(mapAdmin))).toBe(1);
    expect(countUnread(rows.map(mapAccount))).toBe(1);
  });

  it("a new query/lead notification raises the unread count; marking read lowers it", () => {
    let items = [row("old", "query.replied", "2026-01-02T00:00:00.000Z")].map(mapAdmin);
    expect(countUnread(items)).toBe(0);
    items = [...[row("q", "query.new"), row("l", "lead.new")].map(mapAdmin), ...items];
    expect(countUnread(items)).toBe(2);
    items = applyRead(items, new Set(["q"]));
    expect(countUnread(items)).toBe(1);
    expect(countUnread(applyRead(items))).toBe(0);
  });
});
