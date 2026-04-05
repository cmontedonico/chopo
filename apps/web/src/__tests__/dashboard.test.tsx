import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "@chopo-v1/backend/convex/_generated/dataModel";

import { SidebarProvider } from "@chopo-v1/ui/components/sidebar";

import { DashboardPageView } from "../routes/app/index";

const baseResults = [
  {
    _id: "result_1" as Id<"testResults">,
    name: "Glucosa",
    value: 102,
    unit: "mg/dL",
    referenceMin: 70,
    referenceMax: 100,
    status: "high",
    category: "Metabolismo",
  },
  {
    _id: "result_2" as Id<"testResults">,
    name: "Hemoglobina",
    value: 14.2,
    unit: "g/dL",
    referenceMin: 12,
    referenceMax: 16,
    status: "normal",
    category: "Hematología",
  },
] as const;

function renderDashboard(overrides: Partial<Parameters<typeof DashboardPageView>[0]> = {}) {
  return renderToStaticMarkup(
    <SidebarProvider>
      <DashboardPageView
        summary={undefined}
        keyMetrics={undefined}
        history={undefined}
        availableTests={["Glucosa"]}
        selectedTest="Glucosa"
        onSelectedTestChange={() => undefined}
        results={undefined}
        categories={[]}
        selectedCategory="all"
        onSelectedCategoryChange={() => undefined}
        exams={undefined}
        selectedExamA=""
        selectedExamB=""
        onExamAChange={() => undefined}
        onExamBChange={() => undefined}
        comparisonResultsA={undefined}
        comparisonResultsB={undefined}
        defaultTab="table"
        {...overrides}
      />
    </SidebarProvider>,
  );
}

describe("dashboard page", () => {
  test("renders loading states without crashing", () => {
    const html = renderDashboard();

    expect(html.includes('data-slot="skeleton"')).toBe(true);
    expect(html.includes("Dashboard")).toBe(true);
    expect(html.includes("cargando...")).toBe(true);
  });

  test("renders empty states when there are no results", () => {
    const html = renderDashboard({
      summary: {
        totalTests: 0,
        normalCount: 0,
        abnormalCount: 0,
        criticalCount: 0,
        lastExamDate: null,
      },
      keyMetrics: [],
      history: [],
      availableTests: ["Glucosa"],
      results: [],
      categories: [],
      exams: [
        {
          _id: "exam_1" as Id<"exams">,
          examType: "Química sanguínea",
          examDate: Date.now(),
          status: "completed",
        },
      ],
    });

    expect(html.includes("Sube tu primer estudio para ver gráficas")).toBe(true);
    expect(html.includes("No hay resultados. Ve a")).toBe(true);
  });

  test("renders real data and comparison controls", () => {
    const html = renderDashboard({
      summary: {
        totalTests: 2,
        normalCount: 1,
        abnormalCount: 1,
        criticalCount: 0,
        lastExamDate: Date.now(),
      },
      keyMetrics: [
        { name: "Glucosa", value: 102, referenceMax: 100, unit: "mg/dL" },
        { name: "Hemoglobina", value: 14.2, referenceMax: 16, unit: "g/dL" },
      ],
      history: [
        { date: "2024-01", value: 96 },
        { date: "2024-02", value: 102 },
      ],
      availableTests: ["Glucosa", "Hemoglobina"],
      results: [...baseResults],
      categories: ["Metabolismo", "Hematología"],
      exams: [
        {
          _id: "exam_1" as Id<"exams">,
          examType: "Química sanguínea",
          examDate: Date.now() - 86_400_000,
          status: "completed",
        },
        {
          _id: "exam_2" as Id<"exams">,
          examType: "Química sanguínea",
          examDate: Date.now(),
          status: "completed",
        },
      ],
      selectedExamA: "exam_1" as Id<"exams">,
      selectedExamB: "exam_2" as Id<"exams">,
      comparisonResultsA: [
        { ...baseResults[0], value: 110 },
        { ...baseResults[1], value: 13.8 },
      ],
      comparisonResultsB: [...baseResults],
      defaultTab: "comparison",
    });

    expect(html.includes("Comparativa")).toBe(true);
    expect(html.includes("Estudio A")).toBe(true);
    expect(html.includes("Glucosa")).toBe(true);
    expect(html.includes("Hemoglobina")).toBe(true);
  });

  test("category tab only renders categories present in filtered results", () => {
    const html = renderDashboard({
      summary: {
        totalTests: 1,
        normalCount: 0,
        abnormalCount: 1,
        criticalCount: 0,
        lastExamDate: Date.now(),
      },
      keyMetrics: [{ name: "Glucosa", value: 102, referenceMax: 100, unit: "mg/dL" }],
      history: [{ date: "2024-02", value: 102 }],
      availableTests: ["Glucosa"],
      results: [baseResults[0]],
      categories: ["Metabolismo", "Hematología"],
      selectedCategory: "Metabolismo",
      exams: [
        {
          _id: "exam_1" as Id<"exams">,
          examType: "Química sanguínea",
          examDate: Date.now(),
          status: "completed",
        },
      ],
      defaultTab: "category",
    });

    expect(html.includes("Metabolismo")).toBe(true);
    expect(html.includes("0/0 normal")).toBe(false);
  });
});
