import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

import { LandingPage } from "@/components/site/landing/LandingPage";
import { ServicesPage } from "@/components/site/ServicesPage";
import { ProductsListPage } from "@/components/site/ProductsListPage";
import { ContactPage } from "@/components/site/ContactPage";
import { LegalPage } from "@/components/site/LegalPage";
import { LoginScreen } from "@/components/account/LoginScreen";
import { RegisterScreen } from "@/components/account/RegisterScreen";
import { OverviewScreen } from "@/components/account/OverviewScreen";
import { PurchasesScreen } from "@/components/account/PurchasesScreen";
import { InvoicesScreen } from "@/components/account/InvoicesScreen";
import { QueriesScreen } from "@/components/account/QueriesScreen";
import { NotificationsScreen } from "@/components/account/NotificationsScreen";
import { SettingsScreen } from "@/components/account/SettingsScreen";
import { CheckoutScreen } from "@/components/account/CheckoutScreen";
import {
  BLOG_POSTS,
  CASE_STUDIES,
  CATEGORY_TREE,
  CLIENT_LOGOS,
  FEATURED_PRODUCTS,
  LANDING,
  LEGAL_NAV,
  LEGAL_PRIVACY,
  PRODUCTS,
  SERVICES,
  SERVICE_OPTIONS,
  TESTIMONIALS,
} from "@/app/dev/screens/_fixtures/site";
import {
  authEvents,
  chatTranscripts,
  checkoutOffering,
  customer,
  entitlements,
  invoices,
  notifications,
  orders,
  payments,
  queries,
  session,
} from "@/app/dev/screens/_fixtures/account";

describe("Phase 7: Public Site & Customer UI", () => {
  it("renders LandingPage with hero headline and value props", () => {
    render(
      <LandingPage
        content={LANDING}
        services={SERVICES}
        serviceOptions={SERVICE_OPTIONS}
        featuredProducts={FEATURED_PRODUCTS}
        caseStudies={CASE_STUDIES}
        testimonials={TESTIMONIALS}
        logos={CLIENT_LOGOS}
        blogTeasers={BLOG_POSTS}
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders ServicesPage and enforces BR-01 (no prices on services page)", () => {
    const { container } = render(
      <ServicesPage
        services={SERVICES}
      />
    );

    expect(screen.getByRole("heading", { name: "What we build", level: 1 })).toBeInTheDocument();
    // BR-01: No prices anywhere on services
    expect(container.textContent).not.toMatch(/₹\s*\d+/);
    expect(container.textContent).not.toMatch(/\$\s*\d+/);
  });

  it("renders ProductsListPage with catalog filter and items", () => {
    render(
      <ProductsListPage
        products={PRODUCTS}
        categories={CATEGORY_TREE}
        pageSize={12}
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Products/);
    expect(screen.getAllByText("FitDesk Pro").length).toBeGreaterThan(0);
  });

  it("renders ContactPage with trust lines and inquiry form", () => {
    render(
      <ContactPage
        serviceOptions={SERVICE_OPTIONS}
        trustLines={["Fixed-scope proposals", "NDA on request"]}
      />
    );

    expect(screen.getByRole("heading", { name: "Start a project", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Fixed-scope proposals")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send inquiry/i })).toBeInTheDocument();
  });

  it("renders LegalPage with privacy policy sections", () => {
    render(
      <LegalPage
        page={LEGAL_PRIVACY}
        nav={LEGAL_NAV}
      />
    );

    expect(screen.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("1. What we collect").length).toBeGreaterThan(0);
  });

  it("renders LoginScreen with split brand panel and form", () => {
    render(
      <LoginScreen />
    );

    expect(screen.getByRole("heading", { name: "Sign in", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
  });

  it("renders RegisterScreen with policy hints and create account CTA", () => {
    render(
      <RegisterScreen />
    );

    expect(screen.getByRole("heading", { name: "Create your account", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create account/i })).toBeInTheDocument();
  });

  it("renders OverviewScreen with user greeting and active purchases", () => {
    render(
      <OverviewScreen
        firstName="Pravin"
        emailVerified={true}
        actions={[]}
        entitlements={entitlements}
        invoices={invoices}
        queries={queries}
        wishlistCount={2}
        now={new Date().toISOString()}
        links={{
          purchases: "/account/purchases",
          entitlement: (id: string) => `/account/purchases/${id}`,
          invoices: "/account/invoices",
          queries: "/account/queries",
          query: (id: string) => `/account/queries/${id}`,
          wishlist: "/account/wishlist",
          chat: "/account/chat",
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /Hi, Pravin/i, level: 1 })).toBeInTheDocument();
  });

  it("renders PurchasesScreen with entitlements and order tabs", () => {
    render(
      <PurchasesScreen
        entitlements={entitlements}
        orders={[orders.awaitingReference, orders.submitted, orders.confirmed]}
        now={new Date().toISOString()}
        links={{
          entitlement: (id: string) => `/account/purchases/${id}`,
          order: (id: string) => `/account/orders/${id}`,
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /Purchases & access/i, level: 1 })).toBeInTheDocument();
  });

  it("renders InvoicesScreen with financial years and invoice records", () => {
    render(
      <InvoicesScreen
        invoices={invoices}
        payments={payments}
        financialYears={["FY 2026–27", "FY 2025–26", "all"]}
        links={{
          order: (orderNumber: string) => `/account/orders/${orderNumber}`,
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /Invoices & payments/i, level: 1 })).toBeInTheDocument();
  });

  it("renders QueriesScreen with query thread summaries", () => {
    render(
      <QueriesScreen
        queries={queries}
        transcripts={chatTranscripts}
        now={new Date().toISOString()}
        links={{
          query: (id: string) => `/account/queries/${id}`,
          chat: "/account/chat",
          transcript: (id: string) => `/account/chat/${id}`,
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /Queries/i, level: 1 })).toBeInTheDocument();
  });

  it("renders NotificationsScreen with grouped items", () => {
    render(
      <NotificationsScreen
        items={notifications}
        now={new Date().toISOString()}
        links={{
          settings: "/account/settings",
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /Notifications/i, level: 1 })).toBeInTheDocument();
  });

  it("renders SettingsScreen with customer profile and tabs", () => {
    render(
      <SettingsScreen
        profile={customer}
        session={session}
        authEvents={authEvents}
        now={new Date().toISOString()}
      />
    );

    expect(screen.getByRole("heading", { name: /Settings/i, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Pravin Deshmukh").length).toBeGreaterThan(0);
  });

  it("renders CheckoutScreen with billing fields and payment methods", () => {
    render(
      <CheckoutScreen
        offering={checkoutOffering}
        customerEmail="pravin@iauro.com"
        billing={customer.billing}
        links={{
          dashboard: "/account/purchases",
          verify: "/auth/verify",
        }}
      />
    );

    expect(screen.getAllByText(checkoutOffering.productName).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Place order/i })).toBeInTheDocument();
  });
});
