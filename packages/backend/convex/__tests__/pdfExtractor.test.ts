import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractTextFromPdf } from "../lib/pdfExtractor";

describe("convex/lib/pdfExtractor", () => {
  it("extracts text and counts pages from a digital pdf", async () => {
    const fixturePath = new URL("./fixtures/sample-lab-results.pdf", import.meta.url);
    const pdfBuffer = await readFile(fixturePath);
    const result = await extractTextFromPdf(
      pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
    );

    expect(result.error).toBeUndefined();
    expect(result.pages).toBe(1);
    expect(result.text).toContain("Glucosa 92 mg/dL 70 - 100");
    expect(result.text).toContain("Colesterol total 215 mg/dL < 200");
    expect(result.text).toContain("Hemoglobina 14.5 g/dL 13.5 - 17.5");
  });

  it("returns an empty pdf error for an empty buffer", async () => {
    await expect(extractTextFromPdf(new ArrayBuffer(0))).resolves.toEqual({
      text: "",
      pages: 0,
      error: "PDF vacío",
    });
  });

  it("returns a parse error for an invalid buffer without throwing", async () => {
    const invalidBuffer = new TextEncoder().encode("not a pdf").buffer;

    await expect(extractTextFromPdf(invalidBuffer)).resolves.toEqual({
      text: "",
      pages: 0,
      error: "No se pudo leer el PDF",
    });
  });
});
