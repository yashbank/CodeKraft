import { describe, expect, it } from "vitest";
import { chunkText, MAX_CHUNK_LENGTH } from "@/modules/search/indexer";

describe("Knowledge Chunking (PHASE-03 P3.13, docs/04 §9)", () => {
  it("returns empty array for empty or whitespace-only text", () => {
    expect(chunkText("Title", "")).toEqual([]);
    expect(chunkText("Title", "   \n\n   ")).toEqual([]);
  });

  it("creates a single chunk when text <= 1200 characters", () => {
    const text = "Short description of the product or service.";
    const chunks = chunkText("Product Overview", text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.title).toBe("Product Overview");
    expect(chunks[0]?.body).toBe(text);
    expect(chunks[0]!.body.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
  });

  it("splits multi-paragraph text into chunks each <= 1200 characters", () => {
    const p1 = "First section. ".repeat(40); // ~600 chars
    const p2 = "Second section. ".repeat(45); // ~720 chars
    const p3 = "Third section. ".repeat(50); // ~750 chars

    const fullText = `${p1}\n\n${p2}\n\n${p3}`;
    const chunks = chunkText("Comprehensive Guide", fullText);

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    for (const chunk of chunks) {
      expect(chunk.body.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
      expect(chunk.title).toContain("Comprehensive Guide");
    }
  });

  it("partitions oversized single paragraphs without spaces without exceeding 1200 chars", () => {
    const hugeWord = "A".repeat(3000);
    const chunks = chunkText("Huge Monolith", hugeWord);

    expect(chunks.length).toBe(3); // 1200 + 1200 + 600
    for (const chunk of chunks) {
      expect(chunk.body.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
    }
  });
});
