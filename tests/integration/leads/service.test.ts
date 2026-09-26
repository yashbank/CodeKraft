import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { leadsService } from "@/modules/leads/service";
import { leadDigestJob } from "@/jobs/lead-digest";
import { createAdmin, createUser } from "../../factories/users";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { leads } from "../../../drizzle/schema/leads";
import { eq } from "drizzle-orm";

describe("Leads Integration (P6.3 & P6.4)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("creates public lead with Turnstile verification and activity history", async () => {
    const res = await leadsService.createLead(
      { userId: null, roles: [] } as any,
      {
        source: "inquiry_form",
        name: "Jane Doe",
        email: "jane@company.com",
        message: "Need a high-performance web platform",
        turnstileToken: "test-valid-token",
      },
    );

    expect(res.leadId).toBeDefined();

    const detail = await leadsService.getLead(
      { userId: "admin-1", roles: ["super_admin"] } as any,
      { leadId: res.leadId },
    );

    expect(detail.lead.name).toBe("Jane Doe");
    expect(detail.lead.status).toBe("new");
    expect(detail.lead.turnstileVerified).toBe(true);
    expect(detail.activities.length).toBeGreaterThanOrEqual(1);
    expect(detail.activities[0].body).toContain("inquiry_form");
  });

  it("claims lead and prevents conflict if already claimed", async () => {
    const admin1 = await createAdmin({ email: "admin1@test.com" });
    const admin2 = await createAdmin({ email: "admin2@test.com" });

    const res = await leadsService.createLead(
      { userId: null, roles: [] } as any,
      {
        source: "inquiry_form",
        name: "Acme Corp",
        email: "contact@acme.com",
        message: "Enterprise custom architecture",
        turnstileToken: "test-valid-token",
      },
    );

    // Admin 1 claims
    const claimed = await leadsService.claimLead(
      { userId: admin1.id, roles: ["admin"] } as any,
      { leadId: res.leadId },
    );
    expect(claimed.assignedTo?.id).toBe(admin1.id);

    // Admin 2 tries to claim -> CONFLICT
    await expect(
      leadsService.claimLead(
        { userId: admin2.id, roles: ["admin"] } as any,
        { leadId: res.leadId },
      ),
    ).rejects.toThrowError(/already claimed/);
  });

  it("updates lead status with transition validation", async () => {
    const admin = await createAdmin({ email: "admin-status@test.com" });
    const res = await leadsService.createLead(
      { userId: null, roles: [] } as any,
      {
        source: "inquiry_form",
        name: "Pipeline Test",
        email: "pipe@test.com",
        message: "Custom development inquiry",
        turnstileToken: "test-valid-token",
      },
    );

    // new -> contacted
    const contacted = await leadsService.updateLeadStatus(
      { userId: admin.id, roles: ["admin"] } as any,
      { leadId: res.leadId, status: "contacted" },
    );
    expect(contacted.status).toBe("contacted");

    // contacted -> lost requires lostReason
    await expect(
      leadsService.updateLeadStatus(
        { userId: admin.id, roles: ["admin"] } as any,
        { leadId: res.leadId, status: "lost", lostReason: "" },
      ),
    ).rejects.toThrowError(/lostReason is required/);

    const lost = await leadsService.updateLeadStatus(
      { userId: admin.id, roles: ["admin"] } as any,
      { leadId: res.leadId, status: "lost", lostReason: "Budget out of scope" },
    );
    expect(lost.status).toBe("lost");
  });

  it("handles follow-up and overdue digest job (P6.4)", async () => {
    const admin = await createAdmin({ email: "admin-digest@test.com" });
    const res = await leadsService.createLead(
      { userId: null, roles: [] } as any,
      {
        source: "inquiry_form",
        name: "Overdue Lead",
        email: "overdue@test.com",
        message: "Need urgent consultation",
        turnstileToken: "test-valid-token",
      },
    );

    // Assign to admin
    await leadsService.assignLead(
      { userId: admin.id, roles: ["admin"] } as any,
      { leadId: res.leadId, assignedTo: admin.id },
    );

    // Set follow up in the past (overdue)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await leadsService.setFollowUp(
      { userId: admin.id, roles: ["admin"] } as any,
      { leadId: res.leadId, nextFollowUpAt: yesterday },
    );

    // Run digest job
    const outcome = await leadDigestJob.run(new Date());
    expect(outcome.status).toBe("ok");
    expect(outcome.detail.overdueLeads).toBeGreaterThanOrEqual(1);
    expect(outcome.detail.emailsQueued).toBeGreaterThanOrEqual(1);
  });
});
