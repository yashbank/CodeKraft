import { DEFAULT_SITE_NAME } from "@/lib/brand-constants";

/** Settings + counts the first-run checklist is computed from (all real data, no flags of its own). */
export interface SetupInput {
  siteName: string;
  siteLogo: string | null;
  gstin: string | null;
  sellerDetails: object | null;
  razorpayKeyId: string | null;
  upiVpa: string | null;
  bankDetails: object | null;
  emailProblem: string | null;
  publishedProducts: number;
  superAdmins: number;
}

export interface SetupItem {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export function computeSetupChecklist(i: SetupInput): SetupItem[] {
  return [
    {
      id: "site-name",
      label: "Set your site name",
      href: "/admin/settings",
      done: i.siteName.trim() !== "" && i.siteName !== DEFAULT_SITE_NAME,
    },
    { id: "logo", label: "Upload a logo", href: "/admin/settings", done: !!i.siteLogo },
    {
      id: "seller",
      label: "Add seller and GST details",
      href: "/admin/settings",
      done: !!i.sellerDetails && !!i.gstin,
    },
    {
      id: "payments",
      label: "Set up a payment method (Razorpay, UPI or bank)",
      href: "/admin/settings",
      done: !!i.razorpayKeyId || !!i.upiVpa || !!i.bankDetails,
    },
    {
      id: "email",
      label: "Configure the email sender",
      href: "/admin/settings",
      done: i.emailProblem === null,
    },
    {
      id: "product",
      label: "Publish your first product",
      href: "/admin/products",
      done: i.publishedProducts > 0,
    },
    {
      id: "super-admin",
      label: "Add a second super admin",
      href: "/admin/admin-users",
      done: i.superAdmins >= 2,
    },
  ];
}
