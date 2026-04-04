import { describe, expect, it } from "vitest";
import { parseLabResults } from "../lib/labParser";

describe("convex/lib/labParser", () => {
  it("parses a mixed laboratory report and categorizes known analytes", () => {
    const text = [
      "Glucosa          92    mg/dL     70 - 100",
      "Colesterol total 215   mg/dL     < 200",
      "Hemoglobina      14.5  g/dL      13.5 - 17.5",
      "Creatinina       1.1   mg/dL     0.7 - 1.3",
      "TSH              2.8   mUI/L     0.4 - 4.0",
      "Triglicéridos    180   mg/dL     0 - 150",
      "Proteína C reactiva (PCR)  4.2  mg/L  0 - 5",
      "Vitamina D (25-OH) 31.5 ng/mL 30 - 100",
      "Ácido úrico      5.8   mg/dL     3.5 - 7.2",
      "Marcador raro 1.23 U/L 0.2 - 2.0",
      "esta linea no sirve",
    ].join("\n");

    const output = parseLabResults(text, "panel general");

    expect(output.totalLines).toBe(11);
    expect(output.parsedCount).toBe(9);
    expect(output.results).toHaveLength(9);
    expect(output.unrecognized).toEqual(["Marcador raro 1.23 U/L 0.2 - 2.0"]);

    expect(output.results[0]).toEqual({
      name: "Glucosa",
      value: 92,
      unit: "mg/dL",
      referenceMin: 70,
      referenceMax: 100,
      category: "METABOLISMO",
    });
    expect(output.results[1]).toEqual({
      name: "Colesterol total",
      value: 215,
      unit: "mg/dL",
      referenceMin: 0,
      referenceMax: 200,
      category: "LÍPIDOS",
    });
    expect(output.results[2]).toEqual({
      name: "Hemoglobina",
      value: 14.5,
      unit: "g/dL",
      referenceMin: 13.5,
      referenceMax: 17.5,
      category: "HEMATOLOGÍA",
    });
    expect(output.results[3]).toEqual({
      name: "Creatinina",
      value: 1.1,
      unit: "mg/dL",
      referenceMin: 0.7,
      referenceMax: 1.3,
      category: "RENAL",
    });
    expect(output.results[4]).toEqual({
      name: "TSH",
      value: 2.8,
      unit: "mUI/L",
      referenceMin: 0.4,
      referenceMax: 4,
      category: "TIROIDES",
    });
  });

  it("keeps unknown-but-parseable rows in unrecognized and ignores junk", () => {
    const output = parseLabResults(
      ["Marcador raro 1.23 U/L 0.2 - 2.0", "basura aleatoria xyz 123", ""].join("\n"),
      "analisis general",
    );

    expect(output.results).toHaveLength(0);
    expect(output.unrecognized).toEqual(["Marcador raro 1.23 U/L 0.2 - 2.0"]);
    expect(output.totalLines).toBe(2);
    expect(output.parsedCount).toBe(0);
  });

  it("does not throw for empty or invalid text", () => {
    expect(parseLabResults("", "lab")).toEqual({
      results: [],
      unrecognized: [],
      totalLines: 0,
      parsedCount: 0,
    });

    expect(parseLabResults("basura aleatoria xyz 123", "lab")).toEqual({
      results: [],
      unrecognized: [],
      totalLines: 1,
      parsedCount: 0,
    });
  });
});
