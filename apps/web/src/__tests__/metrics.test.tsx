import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "@chopo-v1/backend/convex/_generated/dataModel";

import { SidebarProvider } from "@chopo-v1/ui/components/sidebar";

import {
  MetricCatalogCard,
  MetricDetailsPanel,
  filterHistoryByRange,
  getChartHistory,
  getMetricDeleteConfirmationMessage,
  MetricsPageView,
  toDateTimeLocalValue,
} from "../routes/app/metrics";

const metricCatalog = {
  _id: "metricCatalog_1" as Id<"metricCatalog">,
  name: "Glucosa capilar",
  unit: "mg/dL",
  inputType: "numeric",
  referenceMin: 70,
  referenceMax: 100,
  scaleMax: undefined,
  icon: "Droplets",
  isActive: true,
} as const;

const scaleCatalog = {
  _id: "metricCatalog_2" as Id<"metricCatalog">,
  name: "Nivel de fatiga",
  unit: "—",
  inputType: "scale",
  referenceMin: undefined,
  referenceMax: undefined,
  scaleMax: 10,
  icon: "Battery",
  isActive: true,
} as const;

describe("metrics page", () => {
  test("renders the metrics grid", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <MetricsPageView
          catalogs={[metricCatalog, scaleCatalog]}
          latestMetrics={[
            {
              catalog: metricCatalog,
              latestValue: 92,
              latestDate: Date.now() - 3_600_000,
            },
            {
              catalog: scaleCatalog,
              latestValue: 6,
              latestDate: Date.now() - 86_400_000,
            },
          ]}
          history={undefined}
          selectedCatalogId={null}
          onSelectCatalog={() => undefined}
          onCloseSheet={() => undefined}
          onSubmitMetric={async () => undefined}
          onUpdateMetric={async () => undefined}
          onDeleteMetric={async () => undefined}
        />
      </SidebarProvider>,
    );

    expect(html.includes("Métricas")).toBe(true);
    expect(html.includes("Glucosa capilar")).toBe(true);
    expect(html.includes("Nivel de fatiga")).toBe(true);
    expect(html.includes("Abrir registro rápido")).toBe(true);
  });

  test("wires card clicks to metric selection", () => {
    let receivedCatalogId: Id<"metricCatalog"> | null = null;
    const element = MetricCatalogCard({
      catalog: metricCatalog,
      latest: {
        catalog: metricCatalog,
        latestValue: 92,
        latestDate: Date.now(),
      },
      selected: false,
      onSelect: (catalogId: Id<"metricCatalog">) => {
        receivedCatalogId = catalogId;
      },
    });

    element.props.onClick();

    expect(String(receivedCatalogId)).toBe(String(metricCatalog._id));
  });

  test("renders the registration sheet content for the selected metric", () => {
    const html = renderToStaticMarkup(
      <MetricDetailsPanel
        catalog={scaleCatalog}
        history={[
          {
            _id: "manualMetrics_1" as Id<"manualMetrics">,
            recordedAt: Date.now() - 86_400_000,
            value: 7,
            notes: "Tras una jornada larga",
            catalogId: scaleCatalog._id,
          },
          {
            _id: "manualMetrics_2" as Id<"manualMetrics">,
            recordedAt: Date.now() - 3_600_000,
            value: 6,
            notes: undefined,
            catalogId: scaleCatalog._id,
          },
        ]}
        onSubmit={async () => undefined}
        onUpdateMetric={async () => undefined}
        onDeleteMetric={async () => undefined}
      />,
    );

    expect(html.includes("Registro manual")).toBe(true);
    expect(html.includes("Guardar")).toBe(true);
    expect(html.includes("Evolución temporal")).toBe(true);
    expect(html.includes("Historial completo")).toBe(true);
    expect(html.includes("Acciones")).toBe(true);
    expect(html.includes("Tras una jornada larga")).toBe(true);
  });

  test("builds chart data and range filters from the history", () => {
    const now = Date.now();
    const history = [
      {
        _id: "manualMetrics_1" as Id<"manualMetrics">,
        recordedAt: now - 3_600_000,
        value: 84,
        notes: "Antes del desayuno",
        catalogId: metricCatalog._id,
      },
      {
        _id: "manualMetrics_2" as Id<"manualMetrics">,
        recordedAt: now - 86_400_000 * 45,
        value: 92,
        notes: undefined,
        catalogId: metricCatalog._id,
      },
    ];

    const filtered = filterHistoryByRange(history, "30d");
    const chartData = getChartHistory(filtered);

    expect(filtered.length).toBe(1);
    expect(chartData[0]?.dateLabel.includes("/")).toBe(true);
    expect(chartData[0]?.dateLabel.length).toBe(5);
    expect(chartData[0]?.value).toBe(84);
  });

  test("builds the delete confirmation copy", () => {
    const message = getMetricDeleteConfirmationMessage({
      _id: "manualMetrics_3" as Id<"manualMetrics">,
      recordedAt: Date.UTC(2024, 0, 2, 3, 4),
      value: 7,
      notes: undefined,
      catalogId: scaleCatalog._id,
    });

    expect(message.startsWith("¿Estás seguro de eliminar esta lectura del")).toBe(true);
    expect(message.includes("2024")).toBe(true);
  });

  test("formats datetime-local values for the editor defaults", () => {
    const value = toDateTimeLocalValue(Date.UTC(2024, 0, 2, 3, 4));

    expect(value.includes("2024")).toBe(true);
    expect(value.includes("T")).toBe(true);
  });
});
