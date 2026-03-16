import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@chopo-v1/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@chopo-v1/ui/components/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@chopo-v1/ui/components/chart";
import { Progress } from "@chopo-v1/ui/components/progress";
import { ScrollArea } from "@chopo-v1/ui/components/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@chopo-v1/ui/components/select";
import { Separator } from "@chopo-v1/ui/components/separator";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@chopo-v1/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@chopo-v1/ui/components/tabs";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Droplets,
  Heart,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  BLOOD_TEST_RESULTS,
  CATEGORIES,
  type BloodTestWithHistory,
} from "@/lib/mock-data";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  normal: "text-emerald-500",
  low: "text-amber-500",
  high: "text-orange-500",
  critical: "text-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  normal: "Normal",
  low: "Bajo",
  high: "Alto",
  critical: "Crítico",
};

function StatusBadge({ status }: { status: string }) {
  const variant = status === "normal" ? "secondary" : status === "critical" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className={status !== "normal" && status !== "critical" ? STATUS_COLORS[status] : ""}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function SummaryCards() {
  const total = BLOOD_TEST_RESULTS.length;
  const normal = BLOOD_TEST_RESULTS.filter((r) => r.status === "normal").length;
  const abnormal = total - normal;
  const critical = BLOOD_TEST_RESULTS.filter((r) => r.status === "critical").length;

  const cards = [
    { title: "Total análisis", value: total, icon: Activity, description: "Elementos evaluados" },
    { title: "En rango normal", value: normal, icon: CheckCircle, description: `${Math.round((normal / total) * 100)}% del total` },
    { title: "Fuera de rango", value: abnormal, icon: AlertTriangle, description: "Requieren atención" },
    { title: "Valores críticos", value: critical, icon: Heart, description: critical > 0 ? "Atención inmediata" : "Sin alertas" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function KeyMetricsChart() {
  const keyMetrics = BLOOD_TEST_RESULTS.filter((r) =>
    ["Glucosa", "Colesterol total", "Triglicéridos", "Hemoglobina"].includes(r.name),
  );

  const chartConfig: ChartConfig = {
    value: { label: "Valor", color: "var(--chart-1)" },
    referenceMax: { label: "Máx. referencia", color: "var(--chart-3)" },
  };

  const data = keyMetrics.map((m) => ({
    name: m.name.length > 12 ? `${m.name.slice(0, 12)}…` : m.name,
    value: m.value,
    referenceMax: m.referenceMax,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Indicadores clave
        </CardTitle>
        <CardDescription>Comparativa con valores de referencia</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="referenceMax" fill="var(--chart-3)" radius={[4, 4, 0, 0]} opacity={0.4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function GlucoseHistoryChart() {
  const glucose = BLOOD_TEST_RESULTS.find((r) => r.name === "Glucosa");
  if (!glucose) return null;

  const chartConfig: ChartConfig = {
    value: { label: "Glucosa (mg/dL)", color: "var(--chart-2)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-4 w-4" />
          Glucosa — Historial
        </CardTitle>
        <CardDescription>Últimos 4 estudios</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart data={glucose.history} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis domain={[60, 120]} tickLine={false} axisLine={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ResultsTable({ results }: { results: BloodTestWithHistory[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Análisis</TableHead>
          <TableHead className="text-right">Resultado</TableHead>
          <TableHead className="text-right">Unidad</TableHead>
          <TableHead className="text-right">Ref. mín</TableHead>
          <TableHead className="text-right">Ref. máx</TableHead>
          <TableHead className="text-center">Estado</TableHead>
          <TableHead>Rango</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result) => {
          const range = result.referenceMax - result.referenceMin;
          const pct =
            range > 0
              ? Math.min(100, Math.max(0, ((result.value - result.referenceMin) / range) * 100))
              : 50;
          return (
            <TableRow key={result.id}>
              <TableCell className="font-medium">{result.name}</TableCell>
              <TableCell className={`text-right font-mono ${STATUS_COLORS[result.status]}`}>
                {result.value}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{result.unit}</TableCell>
              <TableCell className="text-right text-muted-foreground">{result.referenceMin}</TableCell>
              <TableCell className="text-right text-muted-foreground">{result.referenceMax}</TableCell>
              <TableCell className="text-center">
                <StatusBadge status={result.status} />
              </TableCell>
              <TableCell className="w-24">
                <Progress value={pct} className="h-2" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filtered =
    selectedCategory === "all"
      ? BLOOD_TEST_RESULTS
      : BLOOD_TEST_RESULTS.filter((r) => r.category === selectedCategory);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de tu última química sanguínea — 40 elementos
          </p>
        </div>
      </div>

      <SummaryCards />

      <div className="grid gap-4 lg:grid-cols-2">
        <KeyMetricsChart />
        <GlucoseHistoryChart />
      </div>

      <Separator />

      <div>
        <Tabs defaultValue="table">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="table">Tabla completa</TabsTrigger>
              <TabsTrigger value="category">Por categoría</TabsTrigger>
            </TabsList>
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v ?? "all")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="table" className="mt-4">
            <Card>
              <ScrollArea className="h-[500px]">
                <ResultsTable results={filtered} />
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="category" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {CATEGORIES.map((category) => {
                const catResults = BLOOD_TEST_RESULTS.filter((r) => r.category === category);
                const normalCount = catResults.filter((r) => r.status === "normal").length;
                return (
                  <Card key={category}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{category}</CardTitle>
                        <Badge variant="secondary">
                          {normalCount}/{catResults.length} normal
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {catResults.map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-sm">
                            <span className="truncate">{r.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono ${STATUS_COLORS[r.status]}`}>
                                {r.value} {r.unit}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
