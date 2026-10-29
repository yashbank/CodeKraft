/** P7-02 — rounded corners on client-logo tiles and the site logo image. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SiteBrandProvider, SiteLogo } from "@/components/brand/site-brand";
import { LogoMark } from "@/components/site/LogoMark";

const LOGO = "https://cdn.acme.test/logo.png";

describe("rounded logo corners", () => {
  it("LogoMark clips its image wrapper with a rounded, overflow-hidden box", () => {
    const html = renderToStaticMarkup(<LogoMark src={LOGO} name="Acme" />);
    expect(html).toMatch(/<span class="[^"]*\brounded-md\b[^"]*"/);
    expect(html).toMatch(/<span class="[^"]*\boverflow-hidden\b[^"]*"/);
  });

  it("SiteLogo image carries the rounded-md class", () => {
    const html = renderToStaticMarkup(
      <SiteBrandProvider siteName="Acme" siteLogo={LOGO}>
        <SiteLogo />
      </SiteBrandProvider>,
    );
    expect(html).toMatch(/<img [^>]*class="[^"]*\brounded-md\b[^"]*"/);
  });
});
