import type { KnowledgeEntry } from "@/modules/help/knowledge";

export const FIXTURE: KnowledgeEntry[] = [
  {
    id: "reset-password",
    title: "Reset your password",
    roles: ["customer"],
    keywords: ["forgot password", "login problem", "cannot sign in", "recover account"],
    body: "Open the sign in page and choose Forgot password.\n\nEnter your email and we send a reset link.\n\nThe link expires in one hour.",
    locale: "en",
  },
  {
    id: "reset-password",
    title: "पासवर्ड रीसेट करें",
    roles: ["customer"],
    keywords: ["पासवर्ड भूल गया", "लॉगिन"],
    body: "साइन इन पेज पर पासवर्ड भूल गए चुनें।\n\nअपना ईमेल दें, हम रीसेट लिंक भेजेंगे।",
    locale: "hi",
  },
  {
    id: "download-invoice",
    title: "Download an invoice",
    roles: ["customer", "partner"],
    keywords: ["receipt", "bill", "gst invoice", "pdf"],
    body: "Go to Account, then Orders. Open the order and press Download invoice.\n\nInvoices are PDF files.",
    locale: "en",
  },
  {
    id: "approve-quote",
    title: "Approve and send a quote",
    roles: ["admin", "staff"],
    keywords: ["quotation", "estimate", "proposal"],
    body: "Open Quotes in the admin menu, review line items, then press Approve.",
    locale: "en",
  },
  {
    id: "manage-roles",
    title: "Manage staff roles",
    roles: ["super_admin"],
    keywords: ["permissions", "access", "role"],
    body: "Only super admins can change staff roles from Settings, Team.",
    locale: "en",
  },
];
