import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/dashboard",
}));

import { AdminShellWrapper } from "@/components/admin/AdminShellWrapper";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { ApprovalsInbox } from "@/components/admin/commerce/ApprovalsInbox";
import { NotificationsInbox } from "@/components/admin/system/NotificationsInbox";
import { ProductsList } from "@/components/admin/catalog/ProductsList";
import { ProductEditor } from "@/components/admin/catalog/ProductEditor";
import { CouponsList } from "@/components/admin/catalog/CouponsList";
import { OrdersList } from "@/components/admin/commerce/OrdersList";
import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { QuotesScreen } from "@/components/admin/commerce/QuotesScreen";
import { CustomersList } from "@/components/admin/commerce/CustomersList";
import { CustomerDetail } from "@/components/admin/commerce/CustomerDetail";
import { EntitlementsScreen } from "@/components/admin/commerce/EntitlementsScreen";
import { LeadsScreen } from "@/components/admin/crm/LeadsScreen";
import { LeadDetail } from "@/components/admin/crm/LeadDetail";
import { QueriesInbox } from "@/components/admin/crm/QueriesInbox";
import { ChatbotMonitor } from "@/components/admin/crm/ChatbotMonitor";
import { LedgerScreen } from "@/components/admin/finance/LedgerScreen";
import { AllocationsScreen } from "@/components/admin/finance/AllocationsScreen";
import { PartnersPayouts } from "@/components/admin/finance/PartnersPayouts";
import { ExpensesScreen } from "@/components/admin/finance/ExpensesScreen";
import { AdjustmentsScreen } from "@/components/admin/finance/AdjustmentsScreen";
import { ReportsScreen } from "@/components/admin/finance/ReportsScreen";
import { LandingEditor } from "@/components/admin/content/LandingEditor";
import { ServicesEditor } from "@/components/admin/content/ServicesEditor";
import { CaseStudiesEditor } from "@/components/admin/content/CaseStudiesEditor";
import { TestimonialsLogos } from "@/components/admin/content/TestimonialsLogos";
import { FaqsEditor } from "@/components/admin/content/FaqsEditor";
import { LegalEditor } from "@/components/admin/content/LegalEditor";
import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { AuditLog } from "@/components/admin/system/AuditLog";
import { AdminUsers } from "@/components/admin/system/AdminUsers";

import {
  ADJUSTMENTS,
  ADMINS,
  ADMIN_USERS,
  ALLOCATIONS,
  APPROVALS,
  AUDIT_ROWS,
  CASE_STUDIES,
  CATEGORIES,
  CHATBOT,
  COMPANY_CARD,
  COUPONS,
  CUSTOMER_CREDITS,
  CUSTOMER_DETAIL,
  CUSTOMER_OPTIONS,
  CUSTOMERS,
  DASHBOARD,
  DELIVERY_TASKS,
  ENTITLEMENTS,
  EXPENSES,
  FAQS,
  LANDING_CHAPTERS,
  LEAD_DETAIL,
  LEADS,
  LEDGER,
  LEGAL_PAGES,
  LOGOS,
  NOTIFICATIONS,
  NOW,
  ORDER_DETAIL,
  ORDERS,
  PARTNER_BALANCES,
  PAYOUTS,
  PRIYA,
  PRODUCT_EDITOR,
  PRODUCTS,
  QUERIES,
  QUERY_THREAD,
  QUOTES,
  REPORTS,
  SERVICES,
  SETTINGS,
  SITE_TESTIMONIALS,
  STATEMENT_HISTORY,
  STATEMENT_PREVIEW,
  TAGS,
} from "@/app/dev/screens/_fixtures/admin";

describe("Phase 8: Admin App UI Screen Integration Tests", () => {
  afterEach(() => {
    cleanup();
  });

  it("P8.1: renders AdminShellWrapper with layout and navigation items", () => {
    render(
      <AdminShellWrapper user={PRIYA}>
        <div data-testid="admin-content">Admin Content Area</div>
      </AdminShellWrapper>
    );

    expect(screen.getByTestId("admin-content")).toBeDefined();
    expect(screen.getAllByText(/CodeKraft/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Account menu for Priya Nair/i)).toBeDefined();
  });

  it("P8.2: renders AdminDashboard with greeting and metrics", () => {
    render(
      <AdminDashboard
        data={DASHBOARD}
        isSuperAdmin={true}
        greeting="Welcome back, Priya"
        dateLabel="FY 2026–27 · Today"
      />
    );

    expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Welcome back, Priya/i)).toBeDefined();
  });

  it("P8.2: renders ApprovalsInbox and NotificationsInbox", () => {
    render(
      <ApprovalsInbox
        approvals={APPROVALS}
        currentUser={PRIYA}
        now={NOW}
      />
    );
    expect(screen.getAllByText(/Approvals/i).length).toBeGreaterThan(0);

    cleanup();

    render(
      <NotificationsInbox
        notifications={NOTIFICATIONS}
        now={NOW}
      />
    );
    expect(screen.getAllByText(/Payment reference submitted/i).length).toBeGreaterThan(0);
  });

  it("P8.3: renders ProductsList and ProductEditor", () => {
    render(
      <ProductsList
        products={PRODUCTS}
        categories={CATEGORIES}
        tags={TAGS}
        now={NOW}
        editorHref="/admin/products"
        approvalsHref="/admin/approvals"
        approvers={["Priya Nair", "Arjun Patel"]}
        showCategories={false}
      />
    );
    expect(screen.getAllByText(/Products/i).length).toBeGreaterThan(0);

    cleanup();

    render(
      <ProductEditor
        product={PRODUCT_EDITOR}
        approvers={["Priya Nair", "Arjun Patel"]}
        listHref="/admin/products"
        approvalsHref="/admin/approvals"
        currencies={["INR", "USD"]}
        gstinConfigured={true}
      />
    );
    expect(screen.getByText(/Basics/i)).toBeDefined();
  });

  it("P8.4: renders CouponsList", () => {
    render(
      <CouponsList
        coupons={COUPONS}
        products={PRODUCTS.map((p) => p.name)}
        ordersHref="/admin/orders"
      />
    );
    expect(screen.getAllByText(/Coupons/i).length).toBeGreaterThan(0);
  });

  it("P8.5: renders OrdersList and OrderDetail", () => {
    render(
      <OrdersList
        orders={ORDERS}
        now={NOW}
        detailHref="/admin/orders"
        newOrderHref="/admin/orders/new"
        customerHref="/admin/customers"
        approvalsHref="/admin/approvals"
        notificationsHref="/admin/notifications"
      />
    );
    expect(screen.getAllByText(/Orders/i).length).toBeGreaterThan(0);

    cleanup();

    render(
      <OrderDetail
        data={ORDER_DETAIL}
        approvers={["Priya Nair", "Arjun Patel"]}
        isSuperAdmin={true}
        customerHref="/admin/customers"
        ledgerHref="/admin/finance/ledger"
        approvalsHref="/admin/approvals"
        queriesHref="/admin/queries"
      />
    );
    expect(screen.getAllByText(/CK-ORD-000012/i).length).toBeGreaterThan(0);
  });

  it("P8.6: renders QuotesScreen", () => {
    render(
      <QuotesScreen
        quotes={QUOTES}
        customers={CUSTOMER_OPTIONS}
        orderHref="/admin/orders"
        customerHref="/admin/customers"
      />
    );
    expect(screen.getAllByText(/Quotes/i).length).toBeGreaterThan(0);
  });

  it("P8.7: renders CustomersList and CustomerDetail", () => {
    render(
      <CustomersList
        customers={CUSTOMERS}
        now={NOW}
        detailHref="/admin/customers"
        quotesHref="/admin/quotes"
        newOrderHref="/admin/orders/new"
      />
    );
    expect(screen.getAllByText(/Customers/i).length).toBeGreaterThan(0);

    cleanup();

    render(
      <CustomerDetail
        data={CUSTOMER_DETAIL}
        now={NOW}
        orderHref="/admin/orders"
        queriesHref="/admin/queries"
        quotesHref="/admin/quotes"
        newOrderHref="/admin/orders/new"
        auditHref="/admin/audit"
      />
    );
    expect(screen.getAllByText(/ravi@example\.com/i).length).toBeGreaterThan(0);
  });

  it("P8.8: renders EntitlementsScreen", () => {
    render(
      <EntitlementsScreen
        entitlements={ENTITLEMENTS}
        tasks={DELIVERY_TASKS}
        admins={ADMINS}
        now={NOW}
        orderHref="/admin/orders"
        customerHref="/admin/customers"
        queriesHref="/admin/queries"
        initialView="entitlements"
      />
    );
    expect(screen.getAllByText(/Entitlements/i).length).toBeGreaterThan(0);
  });

  it("P8.9: renders LeadsScreen and LeadDetail", () => {
    render(
      <LeadsScreen
        leads={LEADS}
        admins={ADMINS}
        currentUser={PRIYA}
        now={NOW}
        detailHref="/admin/leads"
        newOrderHref="/admin/orders/new"
      />
    );
    expect(screen.getAllByText(/Leads/i).length).toBeGreaterThan(0);

    cleanup();

    render(
      <LeadDetail
        data={LEAD_DETAIL}
        now={NOW}
        newOrderHref="/admin/orders/new"
        quotesHref="/admin/quotes"
        chatbotHref="/admin/chatbot"
        customerHref="/admin/customers"
        productHref="/admin/products"
      />
    );
    expect(screen.getAllByText(/Kavya R\./i).length).toBeGreaterThan(0);
  });

  it("P8.10: renders QueriesInbox and ChatbotMonitor", () => {
    render(
      <QueriesInbox
        queries={QUERIES}
        thread={QUERY_THREAD}
        admins={ADMINS}
        customers={CUSTOMER_OPTIONS}
        now={NOW}
        approvalsHref="/admin/approvals"
        leadsHref="/admin/leads"
        customerHref="/admin/customers"
        chatbotHref="/admin/chatbot"
      />
    );
    expect(screen.getAllByText(/Queries/i).length).toBeGreaterThan(0);

    cleanup();

    render(
      <ChatbotMonitor
        data={CHATBOT}
        settingsHref="/admin/settings"
        queriesHref="/admin/queries"
        leadsHref="/admin/leads"
      />
    );
    expect(screen.getAllByText(/Chatbot/i).length).toBeGreaterThan(0);
  });

  it("P8.11: renders Finance suite screens", () => {
    render(
      <LedgerScreen
        entries={LEDGER}
        now={NOW}
        lastPostedAt="2026-09-25T08:30:00.000Z"
        orderHref="/admin/orders"
        adjustmentsHref="/admin/finance/adjustments"
        approvalsHref="/admin/approvals"
        isSuperAdmin={true}
      />
    );
    expect(screen.getAllByText(/Ledger/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <AllocationsScreen
        rows={ALLOCATIONS}
        partners={["Priya Nair", "Arjun Patel"]}
        orderHref="/admin/orders"
        ledgerHref="/admin/finance/ledger"
        productHref="/admin/products"
        isSuperAdmin={true}
      />
    );
    expect(screen.getAllByText(/Allocations/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <PartnersPayouts
        partners={PARTNER_BALANCES}
        company={COMPANY_CARD}
        payouts={PAYOUTS}
        approvers={["Priya Nair", "Arjun Patel"]}
        isSuperAdmin={true}
        statementsHref="/admin/finance/reports"
        ledgerHref="/admin/finance/ledger"
        approvalsHref="/admin/approvals"
      />
    );
    expect(screen.getAllByText(/Partners & payouts/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <ExpensesScreen
        expenses={EXPENSES}
        products={PRODUCTS.map((p) => p.name)}
        ledgerHref="/admin/finance/ledger"
        adjustmentsHref="/admin/finance/adjustments"
        productHref="/admin/products"
      />
    );
    expect(screen.getAllByText(/Expenses/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <AdjustmentsScreen
        adjustments={ADJUSTMENTS}
        partners={PARTNER_BALANCES}
        approvers={["Priya Nair", "Arjun Patel"]}
        ledgerHref="/admin/finance/ledger"
        approvalsHref="/admin/approvals"
      />
    );
    expect(screen.getAllByText(/Adjustments/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <ReportsScreen
        reports={REPORTS}
        customerCredits={CUSTOMER_CREDITS}
        partners={["Priya Nair", "Arjun Patel"]}
        statement={STATEMENT_PREVIEW}
        statementHistory={STATEMENT_HISTORY}
        isSuperAdmin={true}
      />
    );
    expect(screen.getAllByText(/Reports/i).length).toBeGreaterThan(0);
  });

  it("P8.12: renders Content Management screens", () => {
    render(
      <LandingEditor
        chapters={LANDING_CHAPTERS}
        services={SERVICES}
        publishedProducts={PRODUCTS.map((p) => p.name)}
        featured={["FitDesk Pro", "TradeFlow"]}
        canPublish={true}
      />
    );
    expect(screen.getAllByText(/Landing/i).length).toBeGreaterThan(0);
    cleanup();

    render(<ServicesEditor services={SERVICES} />);
    expect(screen.getAllByText(/Services/i).length).toBeGreaterThan(0);
    cleanup();

    render(<CaseStudiesEditor caseStudies={CASE_STUDIES} />);
    expect(screen.getAllByText(/Case studies/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <TestimonialsLogos
        testimonials={SITE_TESTIMONIALS}
        logos={LOGOS}
        products={PRODUCTS.map((p) => p.name)}
      />
    );
    expect(screen.getAllByText(/Testimonials & logos/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <FaqsEditor
        faqs={FAQS}
        products={PRODUCTS.map((p) => p.name)}
      />
    );
    expect(screen.getAllByText(/FAQs/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <LegalEditor
        pages={LEGAL_PAGES}
        isSuperAdmin={true}
      />
    );
    expect(screen.getAllByText(/Legal/i).length).toBeGreaterThan(0);
  });

  it("P8.13 & P8.14: renders System suite screens", () => {
    render(
      <SettingsScreen
        settings={SETTINGS}
        isSuperAdmin={true}
        environment="development"
        chatbotHref="/admin/chatbot"
        auditHref="/admin/audit"
      />
    );
    expect(screen.getAllByText(/General \/ seller/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <AuditLog
        rows={AUDIT_ROWS}
        admins={ADMINS.map((a) => a.name)}
        approvalsHref="/admin/approvals"
      />
    );
    expect(screen.getAllByText(/Audit log/i).length).toBeGreaterThan(0);
    cleanup();

    render(
      <AdminUsers
        users={ADMIN_USERS}
        currentUserId={PRIYA.id}
        approvers={["Priya Nair", "Arjun Patel"]}
        approvalsHref="/admin/approvals"
        productHref="/admin/products"
        auditHref="/admin/audit"
      />
    );
    expect(screen.getAllByText(/Admin users/i).length).toBeGreaterThan(0);
  });
});
