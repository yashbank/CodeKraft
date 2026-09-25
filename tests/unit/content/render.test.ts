import { describe, expect, it } from "vitest";
import { renderToHtml } from "@/modules/content/render";
import { sanitizeHtml } from "@/modules/content/sanitize";
import type { RichTextDoc } from "@/modules/_shared/zod";

describe("Rich-Text Render & Sanitizer (SA-19, TM-21, ADR-10)", () => {
  it("renders basic text and paragraphs correctly", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            {
              type: "text",
              text: "world",
              marks: [{ type: "bold" }],
            },
          ],
        },
      ],
    };

    const html = renderToHtml(doc);
    expect(html).toContain("<p>Hello <strong>world</strong></p>");
  });

  it("handles null, undefined, or empty docs safely", () => {
    expect(renderToHtml(null)).toBe("");
    expect(renderToHtml(undefined)).toBe("");
    expect(renderToHtml({ type: "doc", content: [] })).toBe("");
  });

  describe("@security SA-19 XSS prevention", () => {
    it("strips script tags and executable scripts", () => {
      const dirty = `<p>Safe text</p><script>alert('xss')</script>`;
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("<script>");
      expect(clean).not.toContain("alert('xss')");
      expect(clean).toContain("<p>Safe text</p>");
    });

    it("strips inline event handlers like onerror and onclick", () => {
      const dirty = `<img src="https://example.com/pic.png" onerror="alert(1)" onclick="steal()" alt="test" />`;
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("onerror");
      expect(clean).not.toContain("onclick");
      expect(clean).toContain('src="https://example.com/pic.png"');
    });

    it("strips javascript: pseudo-protocols from links", () => {
      const dirty = `<a href="javascript:alert(1)">Click me</a>`;
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain("javascript:");
      expect(clean).toContain("Click me");
    });

    it("allows youtube-nocookie and vimeo iframes but blocks other hostnames", () => {
      const allowedYoutube = `<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>`;
      const allowedVimeo = `<iframe src="https://player.vimeo.com/video/76979871" width="640" height="360"></iframe>`;
      const evilIframe = `<iframe src="https://evil.com/phishing"></iframe>`;

      expect(sanitizeHtml(allowedYoutube)).toContain("youtube-nocookie.com");
      expect(sanitizeHtml(allowedVimeo)).toContain("player.vimeo.com");
      expect(sanitizeHtml(evilIframe)).not.toContain("evil.com");
    });

    it("adds target='_blank' and rel='noopener noreferrer' to external links", () => {
      const dirty = `<a href="https://google.com">External Link</a>`;
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain('target="_blank"');
      expect(clean).toContain('rel="noopener noreferrer"');
    });
  });
});
