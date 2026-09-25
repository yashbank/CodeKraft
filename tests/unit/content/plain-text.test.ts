import { describe, expect, it } from "vitest";
import { toPlainText } from "@/modules/content/render";
import type { RichTextDoc } from "@/modules/_shared/zod";

describe("Plain-text extraction (P3.10)", () => {
  it("extracts text recursively from complex Tiptap AST", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Main Title" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This is a " },
            { type: "text", text: "bold paragraph", marks: [{ type: "bold" }] },
            { type: "text", text: " with some details." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 2" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const text = toPlainText(doc);
    expect(text).toBe("Main Title This is a bold paragraph with some details. Item 1 Item 2");
  });

  it("handles null and undefined gracefully", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText({ type: "doc" })).toBe("");
  });
});
