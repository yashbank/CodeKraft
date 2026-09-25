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

const INK = "#17181C";
const MUTED = "#5D6068";
const RULE = "#E6E3DC";
const ACCENT = "#3F35D6";

export function EmailLayout({
  preview,
  title,
  children,
  siteUrl,
}: {
  preview: string;
  title: string;
  children: ReactNode;
  siteUrl: string;
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
          <Img
            src={`${siteUrl}/brand/wordmark-mono.svg`}
            alt="CodeKraft"
            width={140}
            height={30}
            style={{ color: INK }}
          />
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
            CodeKraft ·{" "}
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
): Promise<{ html: string; text: string }> {
  const url = typeof data.url === "string" ? data.url : null;
  const code = typeof data.code === "string" ? data.code : null;
  const element = (
    <EmailLayout preview={subject} title={subject} siteUrl={siteUrl}>
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
