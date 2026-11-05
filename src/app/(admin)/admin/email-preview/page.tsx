import { EMAIL_TEMPLATES } from "@/emails";
import { EMAIL_PREVIEW_DATA } from "@/lib/email/preview-data";
import { getEnv } from "@/lib/env";
import { loadEmailTheme } from "@/lib/email/theme";

// Admin-only via the admin layout guard; force-dynamic keeps the strict nonce CSP (isNonceable).
export const dynamic = "force-dynamic";

/** Every email template at phone width with sample data. Dark mode follows the OS setting. */
export default async function EmailPreviewPage() {
  const theme = await loadEmailTheme();
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL;
  const rendered = await Promise.all(
    Object.entries(EMAIL_TEMPLATES).map(async ([name, tpl]) => ({
      name,
      html: (await tpl.render(EMAIL_PREVIEW_DATA[name] ?? {}, siteUrl, theme)).html,
    })),
  );
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Email preview (sample data, 375px wide)</h1>
      <div className="flex flex-wrap gap-6">
        {rendered.map((r) => (
          <figure key={r.name} className="space-y-2">
            <figcaption className="text-sm">{r.name}</figcaption>
            <iframe
              title={r.name}
              srcDoc={r.html}
              sandbox=""
              style={{ width: 375, height: 560, border: "1px solid #888" }}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
