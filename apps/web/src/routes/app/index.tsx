import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { Id } from "@chopo-v1/backend/convex/_generated/dataModel";
import { api } from "@chopo-v1/backend/convex/_generated/api";
import { Badge } from "@chopo-v1/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@chopo-v1/ui/components/chart";
import { Progress } from "@chopo-v1/ui/components/progress";
import { ScrollArea } from "@chopo-v1/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chopo-v1/ui/components/select";
import { Separator } from "@chopo-v1/ui/components/separator";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import { Skeleton } from "@chopo-v1/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chopo-v1/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@chopo-v1/ui/components/tabs";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle,
  Droplets,
  Heart,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

type DashboardSummary = {
  totalTests: number;
  normalCount: number;
  abnormalCount: number;
  criticalCount: number;
  lastExamDate: number | null;
};

type DashboardMetric = {
  name: string;
  value: number;
  referenceMax: number;
  unit: string;
};

type HistoryPoint = {
  date: string;
  value: number;
};

type ExamRecord = {
  _id: Id<"exams">;
  examType: string;
  examDate: number;
  status: string;
};

type TestResultRecord = {
  _id: Id<"testResults">;
  name: string;
  value: number;
  unit: string;
  referenceMin: number;
  referenceMax: number;
  status: string;
  category: string;
};

type ComparisonRow = {
  name: string;
  resultA?: TestResultRecord;
  resultB?: TestResultRecord;
  difference: number | null;
  trend: "up" | "down" | "same" | "na";
  tone: "good" | "bad" | "neutral";
};

const getDashboardSummaryRef = makeFunctionReference<
  "query",
  { patientId?: string },
  DashboardSummary
>("dashboard:getSummary");

const getDashboardKeyMetricsRef = makeFunctionReference<
  "query",
  { patientId?: string },
  DashboardMetric[]
>("dashboard:getKeyMetrics");

const getDashboardResultsRef = makeFunctionReference<
  "query",
  { patientId?: string; category?: string },
  TestResultRecord[]
>("dashboard:getLatestResults");

const getDashboardHistoryRef = makeFunctionReference<
  "query",
  { patientId?: string; testName: string; limit?: number },
  HistoryPoint[]
>("dashboard:getTestHistory");

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

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

function formatExamLabel(exam: ExamRecord) {
  return `${exam.examType} — ${DATE_FORMATTER.format(new Date(exam.examDate))}`;
}

function truncateMetricName(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}…` : name;
}

function distanceToNormalRange(result: TestResultRecord) {
  if (result.value < result.referenceMin) {
    return result.referenceMin - result.value;
  }

  if (result.value > result.referenceMax) {
    return result.value - result.referenceMax;
  }

  return 0;
}

function getComparisonTone(resultA?: TestResultRecord, resultB?: TestResultRecord) {
  if (!resultA || !resultB) {
    return "neutral" as const;
  }

  const distanceA = distanceToNormalRange(resultA);
  const distanceB = distanceToNormalRange(resultB);

  if (distanceB < distanceA) return "good" as const;
  if (distanceB > distanceA) return "bad" as const;
  return "neutral" as const;
}

function buildComparisonRows(
  resultsA: TestResultRecord[],
  resultsB: TestResultRecord[],
): ComparisonRow[] {
  const resultAMap = new Map(resultsA.map((result) => [result.name, result]));
  const resultBMap = new Map(resultsB.map((result) => [result.name, result]));
  const allNames = Array.from(new Set([...resultAMap.keys(), ...resultBMap.keys()])).sort(
    (left, right) => left.localeCompare(right),
  );

  return allNames.map((name) => {
    const resultA = resultAMap.get(name);
    const resultB = resultBMap.get(name);

    if (!resultA || !resultB) {
      return {
        name,
        resultA,
        resultB,
        difference: null,
        trend: "na",
        tone: "neutral",
      };
    }

    const difference = resultB.value - resultA.value;
    const trend = Math.abs(difference) < 0.1 ? "same" : difference > 0 ? "up" : "down";

    return {
      name,
      resultA,
      resultB,
      difference,
      trend,
      tone: getComparisonTone(resultA, resultB),
    };
  });
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-[220px] w-full" />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "normal" ? "secondary" : status === "critical" ? "destructive" : "outline";

  return (
    <Badge
      variant={variant}
      className={status !== "normal" && status !== "critical" ? STATUS_COLORS[status] : ""}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function SummaryCards({ summary }: { summary: DashboardSummary | undefined }) {
  if (summary === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const total = summary.totalTests;
  const normal = summary.normalCount;
  const abnormal = summary.abnormalCount;
  const critical = summary.criticalCount;
  const normalPct = total > 0 ? Math.round((normal / total) * 100) : 0;

  const cards = [
    { title: "Total análisis", value: total, icon: Activity, description: "Elementos evaluados" },
    {
      title: "En rango normal",
      value: normal,
      icon: CheckCircle,
      description: `${normalPct}% del total`,
    },
    {
      title: "Fuera de rango",
      value: abnormal,
      icon: AlertTriangle,
      description: "Requieren atención",
    },
    {
      title: "Valores críticos",
      value: critical,
      icon: Heart,
      description: critical > 0 ? "Atención inmediata" : "Sin alertas",
    },
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

function KeyMetricsChart({ metrics }: { metrics: DashboardMetric[] | undefined }) {
  const chartConfig: ChartConfig = {
    value: { label: "Valor", color: "var(--chart-1)" },
    referenceMax: { label: "Máx. referencia", color: "var(--chart-3)" },
  };

  if (metrics === undefined) {
    return <LoadingCard />;
  }

  if (metrics.length === 0) {
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
          <p className="text-sm text-muted-foreground">Sube tu primer estudio para ver gráficas</p>
        </CardContent>
      </Card>
    );
  }

  const data = metrics.map((metric) => ({
    name: truncateMetricName(metric.name),
    value: metric.value,
    referenceMax: metric.referenceMax,
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

function TestHistoryChart({
  selectedTest,
  onSelectedTestChange,
  availableTests,
  history,
}: {
  selectedTest: string;
  onSelectedTestChange: (value: string) => void;
  availableTests: string[];
  history: HistoryPoint[] | undefined;
}) {
  const chartConfig: ChartConfig = {
    value: { label: `${selectedTest} (historial)`, color: "var(--chart-2)" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              {selectedTest} — Historial
            </CardTitle>
            <CardDescription>Evolución reciente por análisis</CardDescription>
          </div>
          <Select
            value={selectedTest}
            onValueChange={(value) => onSelectedTestChange(value ?? selectedTest)}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Selecciona un análisis" />
            </SelectTrigger>
            <SelectContent>
              {availableTests.map((testName) => (
                <SelectItem key={testName} value={testName}>
                  {testName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {history === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sube tu primer estudio para ver gráficas</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <AreaChart data={history} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
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
        )}
      </CardContent>
    </Card>
  );
}

function ResultsTable({ results }: { results: TestResultRecord[] }) {
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
            <TableRow key={result._id}>
              <TableCell className="font-medium">{result.name}</TableCell>
              <TableCell className={`text-right font-mono ${STATUS_COLORS[result.status] ?? ""}`}>
                {result.value}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{result.unit}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {result.referenceMin}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {result.referenceMax}
              </TableCell>
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

function ResultsTableCard({
  results,
  isLoading,
}: {
  results: TestResultRecord[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading || results === undefined) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No hay resultados. Ve a{" "}
            <a href="/app/upload" className="font-medium text-primary underline">
              Subir resultados
            </a>{" "}
            para comenzar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ScrollArea className="h-[500px]">
        <ResultsTable results={results} />
      </ScrollArea>
    </Card>
  );
}

function CategoryGrid({
  categories,
  results,
}: {
  categories: string[];
  results: TestResultRecord[] | undefined;
}) {
  if (results === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <LoadingCard key={index} />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No hay resultados. Ve a{" "}
            <a href="/app/upload" className="font-medium text-primary underline">
              Subir resultados
            </a>{" "}
            para comenzar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {categories.map((category) => {
        const categoryResults = results.filter((result) => result.category === category);
        const normalCount = categoryResults.filter((result) => result.status === "normal").length;

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{category}</CardTitle>
                <Badge variant="secondary">
                  {normalCount}/{categoryResults.length} normal
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categoryResults.map((result) => (
                  <div key={result._id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{result.name}</span>
                    <span className={`font-mono ${STATUS_COLORS[result.status] ?? ""}`}>
                      {result.value} {result.unit}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ComparisonTrend({ row }: { row: ComparisonRow }) {
  const icon =
    row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : row.trend === "same" ? "→" : "—";
  const className =
    row.tone === "good"
      ? "text-emerald-600"
      : row.tone === "bad"
        ? "text-red-600"
        : "text-muted-foreground";

  return <span className={className}>{icon}</span>;
}

function ComparisonSection({
  exams,
  selectedExamA,
  selectedExamB,
  onExamAChange,
  onExamBChange,
  resultsA,
  resultsB,
}: {
  exams: ExamRecord[] | undefined;
  selectedExamA: string;
  selectedExamB: string;
  onExamAChange: (value: string) => void;
  onExamBChange: (value: string) => void;
  resultsA: TestResultRecord[] | undefined;
  resultsB: TestResultRecord[] | undefined;
}) {
  if (exams === undefined) {
    return <LoadingCard />;
  }

  if (exams.length < 2) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Necesitas al menos 2 estudios para comparar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const comparisonRows =
    resultsA !== undefined && resultsB !== undefined ? buildComparisonRows(resultsA, resultsB) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          Comparativa entre estudios
        </CardTitle>
        <CardDescription>Compara resultados entre dos exámenes distintos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Estudio A</p>
            <Select value={selectedExamA} onValueChange={(value) => onExamAChange(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estudio" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam._id} value={exam._id}>
                    {formatExamLabel(exam)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Estudio B</p>
            <Select value={selectedExamB} onValueChange={(value) => onExamBChange(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estudio" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam._id} value={exam._id}>
                    {formatExamLabel(exam)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedExamA || !selectedExamB ? (
          <p className="text-sm text-muted-foreground">
            Selecciona dos estudios para ver la comparativa.
          </p>
        ) : resultsA === undefined || resultsB === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Análisis</TableHead>
                <TableHead className="text-right">Valor A</TableHead>
                <TableHead className="text-right">Valor B</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-center">Tendencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonRows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">
                    {row.resultA ? `${row.resultA.value} ${row.resultA.unit}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.resultB ? `${row.resultB.value} ${row.resultB.unit}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.difference === null ? "—" : row.difference.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <ComparisonTrend row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPageView({
  summary,
  keyMetrics,
  history,
  availableTests,
  selectedTest,
  onSelectedTestChange,
  results,
  categories,
  selectedCategory,
  onSelectedCategoryChange,
  exams,
  selectedExamA,
  selectedExamB,
  onExamAChange,
  onExamBChange,
  comparisonResultsA,
  comparisonResultsB,
  defaultTab = "table",
}: {
  summary: DashboardSummary | undefined;
  keyMetrics: DashboardMetric[] | undefined;
  history: HistoryPoint[] | undefined;
  availableTests: string[];
  selectedTest: string;
  onSelectedTestChange: (value: string) => void;
  results: TestResultRecord[] | undefined;
  categories: string[];
  selectedCategory: string;
  onSelectedCategoryChange: (value: string) => void;
  exams: ExamRecord[] | undefined;
  selectedExamA: string;
  selectedExamB: string;
  onExamAChange: (value: string) => void;
  onExamBChange: (value: string) => void;
  comparisonResultsA: TestResultRecord[] | undefined;
  comparisonResultsB: TestResultRecord[] | undefined;
  defaultTab?: "table" | "category" | "comparison";
}) {
  const titleSuffix = summary?.totalTests ? `${summary.totalTests} elementos` : "sin resultados";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de tu última química sanguínea — {titleSuffix}
          </p>
        </div>
      </div>

      <SummaryCards summary={summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <KeyMetricsChart metrics={keyMetrics} />
        <TestHistoryChart
          selectedTest={selectedTest}
          onSelectedTestChange={onSelectedTestChange}
          availableTests={availableTests}
          history={history}
        />
      </div>

      <Separator />

      <div>
        <Tabs defaultValue={defaultTab}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="table">Tabla completa</TabsTrigger>
              <TabsTrigger value="category">Por categoría</TabsTrigger>
              <TabsTrigger value="comparison">Comparativa</TabsTrigger>
            </TabsList>
            <Select
              value={selectedCategory}
              onValueChange={(value) => onSelectedCategoryChange(value ?? "all")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="table" className="mt-4">
            <ResultsTableCard results={results} isLoading={results === undefined} />
          </TabsContent>

          <TabsContent value="category" className="mt-4">
            <CategoryGrid categories={categories} results={results} />
          </TabsContent>

          <TabsContent value="comparison" className="mt-4">
            <ComparisonSection
              exams={exams}
              selectedExamA={selectedExamA}
              selectedExamB={selectedExamB}
              onExamAChange={onExamAChange}
              onExamBChange={onExamBChange}
              resultsA={comparisonResultsA}
              resultsB={comparisonResultsB}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTest, setSelectedTest] = useState("Glucosa");
  const [selectedExamA, setSelectedExamA] = useState("");
  const [selectedExamB, setSelectedExamB] = useState("");

  const summary = useQuery(getDashboardSummaryRef, {});
  const keyMetrics = useQuery(getDashboardKeyMetricsRef, {});
  const allResults = useQuery(getDashboardResultsRef, {});
  const exams = useQuery(api.exams.listByPatient, {});
  const history = useQuery(getDashboardHistoryRef, { testName: selectedTest });
  const filteredResults = useQuery(
    getDashboardResultsRef,
    selectedCategory === "all" ? {} : { category: selectedCategory },
  );
  const comparisonResultsA = useQuery(
    api.testResults.listByExam,
    selectedExamA ? { examId: selectedExamA as Id<"exams"> } : "skip",
  );
  const comparisonResultsB = useQuery(
    api.testResults.listByExam,
    selectedExamB ? { examId: selectedExamB as Id<"exams"> } : "skip",
  );

  const categories = useMemo(() => {
    if (!allResults) return [];

    return Array.from(new Set(allResults.map((result) => result.category))).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [allResults]);

  const availableTests = useMemo(() => {
    if (!allResults || allResults.length === 0) {
      return ["Glucosa"];
    }

    return Array.from(new Set(allResults.map((result) => result.name))).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [allResults]);

  useEffect(() => {
    if (!availableTests.includes(selectedTest)) {
      setSelectedTest(availableTests[0] ?? "Glucosa");
    }
  }, [availableTests, selectedTest]);

  useEffect(() => {
    if (!categories.length) {
      if (selectedCategory !== "all") {
        setSelectedCategory("all");
      }
      return;
    }

    if (selectedCategory !== "all" && !categories.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (!exams || exams.length < 2) {
      return;
    }

    if (!selectedExamA) {
      setSelectedExamA(exams[0]?._id ?? "");
    }

    if (!selectedExamB) {
      setSelectedExamB(exams[1]?._id ?? exams[0]?._id ?? "");
    }
  }, [exams, selectedExamA, selectedExamB]);

  return (
    <DashboardPageView
      summary={summary}
      keyMetrics={keyMetrics}
      history={history}
      availableTests={availableTests}
      selectedTest={selectedTest}
      onSelectedTestChange={setSelectedTest}
      results={filteredResults}
      categories={categories}
      selectedCategory={selectedCategory}
      onSelectedCategoryChange={setSelectedCategory}
      exams={exams}
      selectedExamA={selectedExamA}
      selectedExamB={selectedExamB}
      onExamAChange={setSelectedExamA}
      onExamBChange={setSelectedExamB}
      comparisonResultsA={comparisonResultsA}
      comparisonResultsB={comparisonResultsB}
    />
  );
}
