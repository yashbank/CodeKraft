import Script from "next/script";

/**
 * Privacy-friendly analytics (D-1301). Renders nothing unless both env values exist and the
 * site is marked launched (P3 setting; until then `launched` defaults to true only in production).
 */
export function UmamiScript({ launched }: { launched?: boolean } = {}) {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const id = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const isLaunched = launched ?? process.env.APP_ENV === "production";
  if (!src || !id || !isLaunched) return null;
  return <Script src={src} data-website-id={id} strategy="lazyOnload" data-auto-track="true" />;
}
