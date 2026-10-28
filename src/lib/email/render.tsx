/**
 * Base layout for every transactional email. Always ink-on-white regardless of site theme
 * (MASTER_SPEC §7 "Print/PDF/email theming"). Templates in src/emails (P6) wrap their body in this.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Hr,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/components";
import type { ReactNode } from "react";
import { DEFAULT_SITE_NAME } from "@/lib/brand-constants";

const INK = "#17181C";
const MUTED = "#5D6068";
const RULE = "#E6E3DC";
const ACCENT = "#3F35D6";

export function EmailLayout({
  preview,
  title,
  children,
  siteUrl,
  siteName = DEFAULT_SITE_NAME,
  logoUrl = null,
}: {
  preview: string;
  title: string;
  children: ReactNode;
  siteUrl: string;
  /** R8-11 — admin-editable site name; shown as a text wordmark when no logo is set. */
  siteName?: string;
  /** Admin-uploaded site logo (absolute https URL). */
  logoUrl?: string | null;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          backgroundColor: "#FFFFFF",
          color: INK,
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
        }}
      >
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          {logoUrl ? (
            <Img
              src={logoUrl.startsWith("/") ? `${siteUrl}${logoUrl}` : logoUrl}
              alt={siteName}
              height={30}
              style={{ height: 30, width: "auto" }}
            />
          ) : (
            <Text style={{ fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>{siteName}</Text>
          )}
          <Hr style={{ borderColor: RULE, margin: "24px 0" }} />
          <Heading
            as="h1"
            style={{ fontSize: 22, lineHeight: "28px", margin: "0 0 16px", color: INK }}
          >
            {title}
          </Heading>
          <Section>{children}</Section>
          <Hr style={{ borderColor: RULE, margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 12, lineHeight: "18px", color: MUTED, margin: 0 }}>
            {siteName} ·{" "}
            <Link href={siteUrl} style={{ color: ACCENT }}>
              {siteUrl.replace(/^https?:\/\//, "")}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  p: { fontSize: 15, lineHeight: "24px", color: INK, margin: "0 0 16px" },
  muted: { fontSize: 13, lineHeight: "20px", color: MUTED, margin: "0 0 12px" },
  button: {
    display: "inline-block",
    backgroundColor: ACCENT,
    color: "#FFFFFF",
    borderRadius: 8,
    padding: "12px 20px",
    fontWeight: 600,
    textDecoration: "none",
  },
  code: {
    fontFamily: "JetBrains Mono, Menlo, monospace",
    fontSize: 20,
    letterSpacing: 4,
    color: INK,
  },
} as const;

/** Generic renderer used by the transport for templates that P6 has not yet specialised. */
export async function renderGenericEmail(
  subject: string,
  data: Record<string, unknown>,
  siteUrl: string,
  siteName: string = DEFAULT_SITE_NAME,
  logoUrl: string | null = null,
): Promise<{ html: string; text: string }> {
  const url = typeof data.url === "string" ? data.url : null;
  const code = typeof data.code === "string" ? data.code : null;
  const element = (
    <EmailLayout
      preview={subject}
      title={subject}
      siteUrl={siteUrl}
      siteName={siteName}
      logoUrl={logoUrl}
    >
      {url ? (
        <>
          <Text style={emailStyles.p}>
            Use the button below to continue. The link expires soon and works once.
          </Text>
          <Link href={url} style={emailStyles.button}>
            Continue
          </Link>
          <Text style={emailStyles.muted}>Or paste this address into your browser: {url}</Text>
        </>
      ) : null}
      {code ? (
        <>
          <Text style={emailStyles.p}>Your one-time code:</Text>
          <Text style={emailStyles.code}>{code}</Text>
        </>
      ) : null}
      {!url && !code ? <Text style={emailStyles.p}>{String(data.message ?? "")}</Text> : null}
    </EmailLayout>
  );
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
