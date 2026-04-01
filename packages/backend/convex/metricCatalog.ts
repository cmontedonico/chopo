import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireRole } from "./lib/authorization";

type CatalogInputType = "numeric" | "scale";

type CatalogSeed = {
  name: string;
  unit: string;
  inputType: CatalogInputType;
  referenceMin?: number;
  referenceMax?: number;
  scaleMax?: number;
  icon: string;
  isActive: boolean;
};

const DEFAULT_METRICS = [
  {
    name: "Pulso",
    unit: "bpm",
    inputType: "numeric",
    referenceMin: 60,
    referenceMax: 100,
    icon: "Heart",
    isActive: true,
  },
  {
    name: "Presión sistólica",
    unit: "mmHg",
    inputType: "numeric",
    referenceMin: 90,
    referenceMax: 120,
    icon: "Activity",
    isActive: true,
  },
  {
    name: "Presión diastólica",
    unit: "mmHg",
    inputType: "numeric",
    referenceMin: 60,
    referenceMax: 80,
    icon: "Activity",
    isActive: true,
  },
  {
    name: "Oxigenación SpO2",
    unit: "%",
    inputType: "numeric",
    referenceMin: 95,
    referenceMax: 100,
    icon: "Wind",
    isActive: true,
  },
  {
    name: "Temperatura",
    unit: "°C",
    inputType: "numeric",
    referenceMin: 36.1,
    referenceMax: 37.2,
    icon: "Thermometer",
    isActive: true,
  },
  {
    name: "Peso",
    unit: "kg",
    inputType: "numeric",
    icon: "Scale",
    isActive: true,
  },
  {
    name: "Glucosa capilar",
    unit: "mg/dL",
    inputType: "numeric",
    referenceMin: 70,
    referenceMax: 100,
    icon: "Droplets",
    isActive: true,
  },
  {
    name: "Horas de sueño",
    unit: "hrs",
    inputType: "numeric",
    referenceMin: 7,
    referenceMax: 9,
    icon: "Moon",
    isActive: true,
  },
  {
    name: "Nivel de fatiga",
    unit: "—",
    inputType: "scale",
    scaleMax: 10,
    icon: "Battery",
    isActive: true,
  },
  {
    name: "Nivel de estrés",
    unit: "—",
    inputType: "scale",
    scaleMax: 10,
    icon: "Brain",
    isActive: true,
  },
  {
    name: "Nivel de dolor",
    unit: "—",
    inputType: "scale",
    scaleMax: 10,
    icon: "AlertTriangle",
    isActive: true,
  },
  {
    name: "Pasos diarios",
    unit: "pasos",
    inputType: "numeric",
    icon: "Footprints",
    isActive: true,
  },
  {
    name: "Frecuencia respiratoria",
    unit: "rpm",
    inputType: "numeric",
    referenceMin: 12,
    referenceMax: 20,
    icon: "Wind",
    isActive: true,
  },
  {
    name: "Circunferencia abdominal",
    unit: "cm",
    inputType: "numeric",
    icon: "Ruler",
    isActive: true,
  },
  {
    name: "IMC",
    unit: "kg/m²",
    inputType: "numeric",
    referenceMin: 18.5,
    referenceMax: 24.9,
    icon: "Calculator",
    isActive: true,
  },
] satisfies readonly CatalogSeed[];

function isActiveMetric(metric: Doc<"metricCatalog">) {
  return metric.isActive;
}

function sortMetricsByName(metrics: Doc<"metricCatalog">[]) {
  return [...metrics].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) return nameCompare;

    return left._creationTime - right._creationTime;
  });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const metrics = await ctx.db.query("metricCatalog").collect();

    return sortMetricsByName(metrics.filter(isActiveMetric));
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "super_admin");
    const createdIds: Array<Id<"metricCatalog">> = [];

    for (const metric of DEFAULT_METRICS) {
      const existing = await ctx.db
        .query("metricCatalog")
        .withIndex("by_name", (q) => q.eq("name", metric.name))
        .collect();

      if (existing.length > 0) {
        continue;
      }

      const metricId = await ctx.db.insert("metricCatalog", metric);
      createdIds.push(metricId);
    }

    return createdIds;
  },
});

export const update = mutation({
  args: {
    catalogId: v.id("metricCatalog"),
    isActive: v.optional(v.boolean()),
    referenceMin: v.optional(v.number()),
    referenceMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "super_admin");
    const catalog = await ctx.db.get(args.catalogId);

    if (!catalog) {
      throw new Error("Metric not found");
    }

    const updates: Partial<
      Pick<Doc<"metricCatalog">, "isActive" | "referenceMin" | "referenceMax">
    > = {};

    if (args.isActive !== undefined && args.isActive !== catalog.isActive) {
      updates.isActive = args.isActive;
    }

    if (args.referenceMin !== undefined && args.referenceMin !== catalog.referenceMin) {
      updates.referenceMin = args.referenceMin;
    }

    if (args.referenceMax !== undefined && args.referenceMax !== catalog.referenceMax) {
      updates.referenceMax = args.referenceMax;
    }

    if (Object.keys(updates).length === 0) {
      return catalog;
    }

    await ctx.db.patch(args.catalogId, updates);

    const updated = await ctx.db.get(args.catalogId);
    if (!updated) {
      throw new Error("Metric not found");
    }

    return updated;
  },
});
