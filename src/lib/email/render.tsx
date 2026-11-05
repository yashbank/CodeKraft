/**
 * D17-06 - the one shared, mobile-first layout for every transactional email. Table layout, inline
 * styles and hex colours only (no CSS variables / oklch); the accent, radius, font and logo come from
 * the admin's theme (src/lib/email/theme.ts). Dark mode: color-scheme meta plus a prefers-color-scheme
 * block; the logo sits on a light chip there so a dark-on-transparent logo stays visible.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { render } from "@react-email/components";
import type { ReactNode } from "react";
import { DEFAULT_EMAIL_THEME, type EmailTheme } from "./theme";

const INK = "#17181C";
const MUTED = "#5D6068";
const RULE = "#E6E3DC";

/** Every link is resolved against the configured site URL; absolute and mailto links are untouched. */
export function absUrl(href: string, siteUrl: string): string {
  if (/^(https?:|mailto:)/i.test(href) || !siteUrl) return href;
  try {
    return new URL(href, siteUrl).toString();
  } catch {
    return href;
  }
}

const darkCss = (t: EmailTheme) => `
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
.ek-bg{background-color:#0F1014!important}
.ek-card{background-color:#1A1B21!important;border-color:#2C2E38!important}
.ek-card p,.ek-card h1{color:#ECECF0!important}
.ek-card p.ek-muted,.ek-foot{color:#A3A6B0!important}
.ek-card a.ek-link,.ek-foot a{color:${t.accentDark}!important}
.ek-btn{background-color:${t.accentDark}!important}
.ek-btn a{color:${t.accentDarkFg}!important}
.ek-logo{background-color:#FFFFFF!important;padding:6px!important;border-radius:6px!important}
}
@media only screen and (max-width:480px){.ek-card{padding:20px!important}}`;

export function EmailLayout({
  preview,
  title,
  children,
  siteUrl,
  siteName,
  logoUrl,
  theme = DEFAULT_EMAIL_THEME,
}: {
  preview: string;
  title: string;
  children: ReactNode;
  siteUrl: string;
  /** Overrides theme.siteName (kept for callers that already resolved it). */
  siteName?: string;
  /** Overrides theme.logoUrl; null forces the text wordmark. */
  logoUrl?: string | null;
  theme?: EmailTheme;
}) {
  const name = siteName ?? theme.siteName;
  const logo = logoUrl === undefined ? theme.logoUrl : logoUrl;
  const t = { ...theme, siteName: name };
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkCss(t)}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="ek-bg"
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: "#F4F4F6",
          color: INK,
          fontFamily: t.fontStack,
        }}
      >
        <Container style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
          <div style={{ padding: "0 4px 16px" }}>
            {logo ? (
              <Img
                className="ek-logo"
                src={absUrl(logo, siteUrl)}
                alt={name}
                height={28}
                style={{ height: 28, width: "auto", display: "block" }}
              />
            ) : (
              <Text style={{ fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>{name}</Text>
            )}
          </div>
          <div
            className="ek-card"
            style={{
              backgroundColor: "#FFFFFF",
              border: `1px solid ${RULE}`,
              borderRadius: t.radius + 4,
              padding: "28px 24px",
            }}
          >
            <Heading
              as="h1"
              style={{ fontSize: 22, lineHeight: "28px", margin: "0 0 16px", color: INK }}
            >
              {title}
            </Heading>
            {children}
          </div>
          <Text
            className="ek-foot"
            style={{ fontSize: 12, lineHeight: "18px", color: MUTED, margin: "16px 4px 0" }}
          >
            {name} ·{" "}
            <Link href={siteUrl} style={{ color: t.accent }}>
              {siteUrl.replace(/^https?:\/\//, "")}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Bulletproof button (table cell fill) with black/white text picked for contrast on the accent. */
// theme/siteUrl are props (no React context) so concurrent renders can never share state.
export function EmailButton({
  href,
  children,
  theme,
  siteUrl,
}: {
  href: string;
  children: ReactNode;
  theme: EmailTheme;
  siteUrl: string;
}) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0 16px" }}>
      <tbody>
        <tr>
          <td
            className="ek-btn"

            style={{ backgroundColor: theme.accent, borderRadius: theme.radius }}
          >
            <a
              href={absUrl(href, siteUrl)}
              style={{
                display: "inline-block",
                padding: "12px 22px",
                color: theme.accentFg,
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
                borderRadius: theme.radius,
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export const emailStyles = {
  p: { fontSize: 15, lineHeight: "24px", color: INK, margin: "0 0 16px" },
  muted: { fontSize: 13, lineHeight: "20px", color: MUTED, margin: "0 0 12px" },
  code: {
    fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
    fontSize: 22,
    letterSpacing: 4,
    color: INK,
    margin: "0 0 16px",
  },
} as const;

/** Generic renderer used by the transport for templates that P6 has not yet specialised. */
export async function renderGenericEmail(
  subject: string,
  data: Record<string, unknown>,
  siteUrl: string,
  siteName?: string,
  logoUrl?: string | null,
  theme?: EmailTheme,
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
      theme={theme}
    >
      {url ? (
        <>
          <Text style={emailStyles.p}>
            Use the button below to continue. The link expires soon and works once.
          </Text>
          <EmailButton href={url} theme={theme ?? DEFAULT_EMAIL_THEME} siteUrl={siteUrl}>
            Continue
          </EmailButton>
          <Text className="ek-muted" style={emailStyles.muted}>
            Or paste this address into your browser: {url}
          </Text>
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
