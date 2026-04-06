import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@chopo-v1/backend/convex/_generated/dataModel";
import { api } from "@chopo-v1/backend/convex/_generated/api";
import { Badge } from "@chopo-v1/ui/components/badge";
import { Button } from "@chopo-v1/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@chopo-v1/ui/components/dialog";
import { Input } from "@chopo-v1/ui/components/input";
import { Label } from "@chopo-v1/ui/components/label";
import { ScrollArea } from "@chopo-v1/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chopo-v1/ui/components/select";
import { Separator } from "@chopo-v1/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@chopo-v1/ui/components/sheet";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import { Skeleton } from "@chopo-v1/ui/components/skeleton";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@chopo-v1/ui/components/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chopo-v1/ui/components/table";
import { Textarea } from "@chopo-v1/ui/components/textarea";
import { cn } from "@chopo-v1/ui/lib/utils";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import {
  Activity,
  AlertTriangle,
  Check,
  Battery,
  Brain,
  Calculator,
  Droplets,
  Footprints,
  Heart,
  Moon,
  Plus,
  Pencil,
  Ruler,
  Scale,
  Trash2,
  Thermometer,
  X,
  Wind,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@chopo-v1/ui/components/chart";

export const Route = createFileRoute("/app/metrics")({
  component: MetricsPage,
});

type MetricCatalogRecord = {
  _id: Id<"metricCatalog">;
  name: string;
  unit: string;
  inputType: string;
  referenceMin?: number;
  referenceMax?: number;
  scaleMax?: number;
  icon: string;
  isActive: boolean;
};

type LatestMetricRecord = {
  catalog: MetricCatalogRecord;
  latestValue: number | null;
  latestDate: number | null;
};

type ManualMetricRecord = {
  _id: Id<"manualMetrics">;
  recordedAt: number;
  value: number;
  notes?: string;
  catalogId: Id<"metricCatalog">;
};

type MetricCreateArgs = {
  catalogId: Id<"metricCatalog">;
  value: number;
  recordedAt: number;
  notes?: string;
};

type MetricUpdateArgs = {
  metricId: Id<"manualMetrics">;
  value: number;
};

type MetricDeleteArgs = {
  metricId: Id<"manualMetrics">;
};

type MetricStatus = "normal" | "abnormal" | "none";
type MetricRange = "7d" | "30d" | "90d" | "all";

type ChartHistoryRecord = ManualMetricRecord & {
  dateLabel: string;
};

const ICONS: Record<string, typeof Activity> = {
  Activity,
  AlertTriangle,
  Battery,
  Brain,
  Calculator,
  Droplets,
  Footprints,
  Heart,
  Moon,
  Ruler,
  Scale,
  Thermometer,
  Wind,
};

const VALUE_FORMATTER = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

function getCatalogIcon(iconName: string) {
  return ICONS[iconName] ?? Activity;
}

function formatValue(value: number) {
  return VALUE_FORMATTER.format(value);
}

function formatDateTime(timestamp: number) {
  return DATE_TIME_FORMATTER.format(new Date(timestamp));
}

function formatDateOnly(timestamp: number) {
  return DATE_ONLY_FORMATTER.format(new Date(timestamp));
}

const CHART_TIME_RANGE_OPTIONS: Array<{
  value: MetricRange;
  label: string;
}> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "Todo" },
];

const CHART_RANGE_LIMITS: Record<Exclude<MetricRange, "all">, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

function formatChartDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `${day}/${month}`;
}

function getChartHistory(history: ManualMetricRecord[]) {
  return history.map((entry) => ({
    ...entry,
    dateLabel: formatChartDateLabel(entry.recordedAt),
  }));
}

function filterHistoryByRange(history: ManualMetricRecord[], range: MetricRange) {
  if (range === "all") {
    return history;
  }

  const cutoff = Date.now() - CHART_RANGE_LIMITS[range];
  return history.filter((entry) => entry.recordedAt >= cutoff);
}

function getMetricDeleteConfirmationMessage(entry: ManualMetricRecord) {
  return `¿Estás seguro de eliminar esta lectura del ${formatDateOnly(entry.recordedAt)}?`;
}

function formatRelativeTime(timestamp: number | null) {
  if (timestamp === null) {
    return "Sin fecha";
  }

  const diff = timestamp - Date.now();
  const absolute = Math.abs(diff);

  if (absolute < 60_000) {
    return new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" }).format(
      Math.round(diff / 1000),
      "second",
    );
  }

  if (absolute < 3_600_000) {
    return new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" }).format(
      Math.round(diff / 60_000),
      "minute",
    );
  }

  if (absolute < 86_400_000) {
    return new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" }).format(
      Math.round(diff / 3_600_000),
      "hour",
    );
  }

  return new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" }).format(
    Math.round(diff / 86_400_000),
    "day",
  );
}

function toDateTimeLocalValue(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function getMetricStatus(catalog: MetricCatalogRecord, latestValue: number | null): MetricStatus {
  if (
    latestValue === null ||
    catalog.referenceMin === undefined ||
    catalog.referenceMax === undefined
  ) {
    return "none";
  }

  return latestValue >= catalog.referenceMin && latestValue <= catalog.referenceMax
    ? "normal"
    : "abnormal";
}

function getMetricStatusTone(status: MetricStatus) {
  if (status === "normal") {
    return {
      label: "En rango",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      variant: "secondary" as const,
    };
  }

  if (status === "abnormal") {
    return {
      label: "Fuera de rango",
      className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
      variant: "destructive" as const,
    };
  }

  return null;
}

function getSelectedCatalog(
  catalogs: MetricCatalogRecord[] | undefined,
  selectedCatalogId: Id<"metricCatalog"> | null,
) {
  return catalogs?.find((catalog) => catalog._id === selectedCatalogId) ?? null;
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-10 w-10 rounded-none" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onOpenQuickAdd }: { onOpenQuickAdd?: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground">
          <Activity className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-medium">Registra tu primera métrica de salud</h2>
          <p className="text-sm text-muted-foreground">
            Usa el botón flotante para empezar a guardar tu actividad manual o{" "}
            <Link
              to="/app/upload"
              className="font-medium text-primary underline underline-offset-3"
            >
              sube resultados
            </Link>
            .
          </p>
        </div>
        {onOpenQuickAdd ? (
          <Button type="button" onClick={onOpenQuickAdd}>
            Registrar métrica
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCatalogCard({
  catalog,
  latest,
  selected,
  onSelect,
}: {
  catalog: MetricCatalogRecord;
  latest: LatestMetricRecord | undefined;
  selected: boolean;
  onSelect: (catalogId: Id<"metricCatalog">) => void;
}) {
  const Icon = getCatalogIcon(catalog.icon);
  const status = getMetricStatus(catalog, latest?.latestValue ?? null);
  const tone = getMetricStatusTone(status);

  return (
    <button
      type="button"
      onClick={() => onSelect(catalog._id)}
      className="group block h-full w-full text-left"
    >
      <Card
        className={cn(
          "h-full transition-colors group-hover:bg-muted/30",
          selected && "ring-1 ring-primary",
        )}
      >
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-none bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-sm">{catalog.name}</CardTitle>
                <CardDescription>{catalog.unit}</CardDescription>
              </div>
            </div>
            {tone ? (
              <Badge variant={tone.variant} className={tone.className}>
                {tone.label}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {latest?.latestValue !== null && latest?.latestValue !== undefined ? (
            <>
              <div className="text-2xl font-semibold">{formatValue(latest.latestValue)}</div>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(latest.latestDate)} · {catalog.unit}
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold text-muted-foreground">Sin registros</div>
              <p className="text-xs text-muted-foreground">
                Pulsa para registrar la primera lectura
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

function MetricValueField({
  catalog,
  value,
  onValueChange,
  inputId,
}: {
  catalog: MetricCatalogRecord;
  value: string;
  onValueChange: (value: string) => void;
  inputId?: string;
}) {
  if (catalog.inputType === "scale") {
    const max = catalog.scaleMax ?? 10;
    const sliderValue = Number(value) || Math.max(1, Math.ceil(max / 2));

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Valor</Label>
          <span className="text-xs text-muted-foreground">Seleccionado: {sliderValue}</span>
        </div>
        <Slider
          min={1}
          max={max}
          step={1}
          value={sliderValue}
          onValueChange={(next) => onValueChange(String(next))}
        >
          <SliderControl>
            <SliderTrack>
              <SliderIndicator />
            </SliderTrack>
            <SliderThumb index={0} />
          </SliderControl>
        </Slider>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId ?? "metric-value"}>Valor</Label>
      <Input
        id={inputId ?? "metric-value"}
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={`Ingresa ${catalog.unit}`}
      />
    </div>
  );
}

function MetricEvolutionChart({
  catalog,
  history,
  range,
}: {
  catalog: MetricCatalogRecord;
  history: ManualMetricRecord[];
  range: MetricRange;
}) {
  const chartData = useMemo(
    () => getChartHistory(filterHistoryByRange(history, range)),
    [history, range],
  );
  const chartConfig: ChartConfig = {
    value: {
      label: `${catalog.name} · evolución`,
      color: "var(--chart-2)",
    },
  };

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-none border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
        No hay lecturas en este rango temporal.
      </div>
    );
  }

  const isNumeric = catalog.inputType === "numeric";

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      {isNumeric ? (
        <AreaChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
          {catalog.referenceMin !== undefined ? (
            <ReferenceLine
              y={catalog.referenceMin}
              stroke="var(--chart-3)"
              strokeDasharray="4 4"
              label={{ value: "Mín", position: "insideTopLeft" }}
            />
          ) : null}
          {catalog.referenceMax !== undefined ? (
            <ReferenceLine
              y={catalog.referenceMax}
              stroke="var(--chart-4)"
              strokeDasharray="4 4"
              label={{ value: "Máx", position: "insideBottomLeft" }}
            />
          ) : null}
          <ChartTooltip content={<MetricChartTooltip catalog={catalog} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      ) : (
        <BarChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
          <ChartTooltip content={<MetricChartTooltip catalog={catalog} />} />
          <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ChartContainer>
  );
}

function MetricChartTooltip({
  active,
  payload,
  catalog,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartHistoryRecord; value?: number }>;
  catalog: MetricCatalogRecord;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0]?.payload;
  if (!entry) {
    return null;
  }

  return (
    <div className="grid min-w-44 gap-1.5 rounded-none border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatDateTime(entry.recordedAt)}</div>
      <div className="text-muted-foreground">
        Valor: <span className="font-mono text-foreground">{formatValue(entry.value)}</span>{" "}
        {catalog.unit}
      </div>
      {entry.notes ? <div className="text-muted-foreground">Nota: {entry.notes}</div> : null}
    </div>
  );
}

function MetricDeleteConfirmationDialog({
  entry,
  open,
  onOpenChange,
  onConfirm,
}: {
  entry: ManualMetricRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const question = entry ? getMetricDeleteConfirmationMessage(entry) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar lectura</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              await onConfirm();
            }}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricHistoryTable({
  history,
  onUpdateMetric,
  onDeleteMetric,
}: {
  history: ManualMetricRecord[];
  onUpdateMetric: (args: MetricUpdateArgs) => Promise<void>;
  onDeleteMetric: (args: MetricDeleteArgs) => Promise<void>;
}) {
  const [editingMetricId, setEditingMetricId] = useState<Id<"manualMetrics"> | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<ManualMetricRecord | null>(null);

  const orderedHistory = useMemo(() => [...history].reverse(), [history]);
  const editingEntry = useMemo(
    () => history.find((entry) => entry._id === editingMetricId) ?? null,
    [editingMetricId, history],
  );

  useEffect(() => {
    if (editingMetricId && !history.some((entry) => entry._id === editingMetricId)) {
      setEditingMetricId(null);
      setEditingValue("");
    }
  }, [editingMetricId, history]);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Todavía no hay historial para esta métrica.</p>
    );
  }

  const startEditing = (entry: ManualMetricRecord) => {
    setEditingMetricId(entry._id);
    setEditingValue(String(entry.value));
  };

  const cancelEditing = () => {
    setEditingMetricId(null);
    setEditingValue("");
  };

  const saveEditing = async () => {
    if (!editingEntry) {
      return;
    }

    const numericValue = Number(editingValue);
    if (!Number.isFinite(numericValue)) {
      toast.error("No se pudo actualizar la métrica");
      return;
    }

    try {
      await onUpdateMetric({
        metricId: editingEntry._id,
        value: numericValue,
      });
      toast.success("Métrica actualizada");
      cancelEditing();
    } catch {
      toast.error("No se pudo actualizar la métrica");
    }
  };

  const deletePendingEntry = pendingDeleteEntry;

  return (
    <div className="space-y-3">
      <ScrollArea className="max-h-[300px] rounded-none border border-border/60 pr-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedHistory.map((entry) => {
              const isEditing = editingMetricId === entry._id;

              return (
                <TableRow key={entry._id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(entry.recordedAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {isEditing ? (
                      <Input
                        className="h-8 w-24 text-right"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                      />
                    ) : (
                      formatValue(entry.value)
                    )}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {entry.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={saveEditing}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="sr-only">Guardar</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={cancelEditing}
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">Cancelar</span>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEditing(entry)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPendingDeleteEntry(entry)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <MetricDeleteConfirmationDialog
        entry={deletePendingEntry}
        open={deletePendingEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteEntry(null);
          }
        }}
        onConfirm={async () => {
          if (!deletePendingEntry) {
            return;
          }

          try {
            await onDeleteMetric({ metricId: deletePendingEntry._id });
            toast.success("Lectura eliminada");
            setPendingDeleteEntry(null);
          } catch {
            toast.error("No se pudo eliminar la lectura");
          }
        }}
      />
    </div>
  );
}

function MetricDetailsPanel({
  catalog,
  history,
  onSubmit,
  onUpdateMetric,
  onDeleteMetric,
}: {
  catalog: MetricCatalogRecord;
  history: ManualMetricRecord[] | undefined;
  onSubmit: (args: MetricCreateArgs) => Promise<void>;
  onUpdateMetric: (args: MetricUpdateArgs) => Promise<void>;
  onDeleteMetric: (args: MetricDeleteArgs) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState(toDateTimeLocalValue(Date.now()));
  const [notes, setNotes] = useState("");
  const [range, setRange] = useState<MetricRange>("30d");

  useEffect(() => {
    setValue(catalog.inputType === "scale" ? String(Math.ceil((catalog.scaleMax ?? 10) / 2)) : "");
    setRecordedAt(toDateTimeLocalValue(Date.now()));
    setNotes("");
    setRange("30d");
  }, [catalog._id, catalog.inputType, catalog.scaleMax]);

  const canSave = value.trim() !== "";
  const Icon = getCatalogIcon(catalog.icon);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-none bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Registro manual
            </p>
            <h3 className="text-base font-semibold">
              {catalog.name} · {catalog.unit}
            </h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Guarda una nueva lectura, revisa su evolución y administra el historial completo.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Evolución temporal</h4>
            <p className="text-xs text-muted-foreground">Filtra el historial por rango temporal</p>
          </div>
          <ToggleGroup
            value={[range]}
            onValueChange={(groupValue) => {
              const nextValue = groupValue[0] as MetricRange | undefined;
              if (nextValue) {
                setRange(nextValue);
              }
            }}
            className="flex gap-1"
          >
            {CHART_TIME_RANGE_OPTIONS.map((option) => (
              <Toggle
                key={option.value}
                value={option.value}
                className={cn(
                  "inline-flex h-7 items-center justify-center rounded-none border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground",
                )}
              >
                {option.label}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>

        {history === undefined ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <MetricEvolutionChart catalog={catalog} history={history} range={range} />
        )}
      </div>

      <div className="space-y-4">
        <MetricValueField
          catalog={catalog}
          value={value}
          onValueChange={setValue}
          inputId={`metric-value-${catalog._id}`}
        />

        <div className="space-y-2">
          <Label htmlFor="metric-recorded-at">Fecha y hora</Label>
          <Input
            id="metric-recorded-at"
            type="datetime-local"
            value={recordedAt}
            onChange={(event) => setRecordedAt(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="metric-notes">Notas</Label>
          <Textarea
            id="metric-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observaciones opcionales"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!canSave}
          onClick={async () => {
            const trimmedValue = value.trim();
            if (trimmedValue === "") {
              return;
            }

            const numericValue = Number(trimmedValue);
            if (!Number.isFinite(numericValue)) {
              return;
            }

            try {
              await onSubmit({
                catalogId: catalog._id,
                value: numericValue,
                recordedAt: parseDateTimeLocalValue(recordedAt),
                notes: notes.trim() ? notes.trim() : undefined,
              });

              toast.success("Métrica registrada");
              setValue(
                catalog.inputType === "scale"
                  ? String(Math.ceil((catalog.scaleMax ?? 10) / 2))
                  : "",
              );
              setRecordedAt(toDateTimeLocalValue(Date.now()));
              setNotes("");
            } catch {
              toast.error("No se pudo guardar la métrica");
            }
          }}
        >
          Guardar
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">Historial completo</h4>
          <p className="text-xs text-muted-foreground">Fecha/Hora, valor, notas y acciones</p>
        </div>
        {history === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <MetricHistoryTable
            history={history}
            onUpdateMetric={onUpdateMetric}
            onDeleteMetric={onDeleteMetric}
          />
        )}
      </div>
    </div>
  );
}

function QuickAddDialog({
  catalogs,
  onSubmit,
}: {
  catalogs: MetricCatalogRecord[];
  onSubmit: (args: MetricCreateArgs) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [value, setValue] = useState("");

  const selectedCatalog = catalogs.find((catalog) => String(catalog._id) === catalogId) ?? null;

  useEffect(() => {
    if (!catalogs.length) {
      return;
    }

    const stillExists = catalogId && catalogs.some((c) => String(c._id) === catalogId);
    if (!stillExists) {
      setCatalogId(String(catalogs[0]._id));
    }
  }, [catalogId, catalogs]);

  useEffect(() => {
    if (!selectedCatalog) {
      return;
    }

    setValue(
      selectedCatalog.inputType === "scale"
        ? String(Math.ceil((selectedCatalog.scaleMax ?? 10) / 2))
        : "",
    );
  }, [selectedCatalog?._id, selectedCatalog?.inputType, selectedCatalog?.scaleMax]);

  const canSubmit = selectedCatalog !== null && value.trim() !== "";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registro rápido</DialogTitle>
            <DialogDescription>Guarda una métrica manual en segundos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-metric">Métrica</Label>
              <Select value={catalogId} onValueChange={(next) => setCatalogId(next ?? "")}>
                <SelectTrigger id="quick-metric" className="w-full">
                  <SelectValue placeholder="Selecciona una métrica" />
                </SelectTrigger>
                <SelectContent>
                  {catalogs.map((catalog) => (
                    <SelectItem key={catalog._id} value={String(catalog._id)}>
                      {catalog.name} — {catalog.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCatalog ? (
              <MetricValueField
                catalog={selectedCatalog}
                value={value}
                onValueChange={setValue}
                inputId="quick-add-value"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay métricas disponibles para registrar.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!canSubmit}
              onClick={async () => {
                if (!selectedCatalog) {
                  return;
                }

                const trimmedValue = value.trim();
                if (trimmedValue === "") {
                  return;
                }

                const numericValue = Number(trimmedValue);
                if (!Number.isFinite(numericValue)) {
                  return;
                }

                try {
                  await onSubmit({
                    catalogId: selectedCatalog._id,
                    value: numericValue,
                    recordedAt: Date.now(),
                  });

                  toast.success("Métrica registrada");
                  setValue(
                    selectedCatalog.inputType === "scale"
                      ? String(Math.ceil((selectedCatalog.scaleMax ?? 10) / 2))
                      : "",
                  );
                  setOpen(false);
                } catch {
                  toast.error("No se pudo guardar la métrica");
                }
              }}
            >
              Registrar rápido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        size="icon-lg"
        className="fixed right-6 bottom-6 z-40 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        disabled={catalogs.length === 0}
      >
        <Plus className="h-5 w-5" />
        <span className="sr-only">Abrir registro rápido</span>
      </Button>
    </>
  );
}

function MetricsPageView({
  catalogs,
  latestMetrics,
  history,
  selectedCatalogId,
  onSelectCatalog,
  onCloseSheet,
  onSubmitMetric,
  onUpdateMetric,
  onDeleteMetric,
}: {
  catalogs: MetricCatalogRecord[] | undefined;
  latestMetrics: LatestMetricRecord[] | undefined;
  history: ManualMetricRecord[] | undefined;
  selectedCatalogId: Id<"metricCatalog"> | null;
  onSelectCatalog: (catalogId: Id<"metricCatalog">) => void;
  onCloseSheet: () => void;
  onSubmitMetric: (args: MetricCreateArgs) => Promise<void>;
  onUpdateMetric: (args: MetricUpdateArgs) => Promise<void>;
  onDeleteMetric: (args: MetricDeleteArgs) => Promise<void>;
}) {
  if (catalogs === undefined || latestMetrics === undefined) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <LoadingGrid />
      </div>
    );
  }

  if (catalogs.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-2xl font-semibold">Métricas</h1>
            <p className="text-sm text-muted-foreground">Registra y sigue tus métricas manuales.</p>
          </div>
        </div>
        <EmptyState />
      </div>
    );
  }

  const selectedCatalog = getSelectedCatalog(catalogs, selectedCatalogId);
  const latestByCatalogId = new Map(latestMetrics.map((entry) => [entry.catalog._id, entry]));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-4">
        <SidebarTrigger />
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Fase 4 · Registro manual
            </p>
            <h1 className="text-2xl font-semibold">Métricas</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Registra lecturas manuales y visualiza el avance de tu salud con acceso rápido a cada
              métrica.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{catalogs.length} métricas</Badge>
            <span>·</span>
            <span>Lectura reciente y acceso rápido desde cualquier card</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {catalogs.map((catalog) => (
          <MetricCatalogCard
            key={catalog._id}
            catalog={catalog}
            latest={latestByCatalogId.get(catalog._id)}
            selected={selectedCatalogId === catalog._id}
            onSelect={onSelectCatalog}
          />
        ))}
      </div>

      <Sheet open={selectedCatalog !== null} onOpenChange={(open) => !open && onCloseSheet()}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Registrar métrica</SheetTitle>
            <SheetDescription>
              {selectedCatalog
                ? `${selectedCatalog.name} · ${selectedCatalog.unit}`
                : "Selecciona una métrica"}
            </SheetDescription>
          </SheetHeader>
          <Separator className="my-4" />
          {selectedCatalog ? (
            <MetricDetailsPanel
              catalog={selectedCatalog}
              history={history}
              onSubmit={onSubmitMetric}
              onUpdateMetric={onUpdateMetric}
              onDeleteMetric={onDeleteMetric}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <QuickAddDialog catalogs={catalogs} onSubmit={onSubmitMetric} />
    </div>
  );
}

function MetricsPage() {
  const { isAuthenticated } = useCurrentUser();
  const catalogs = useQuery(api.metricCatalog.list, isAuthenticated ? {} : "skip");
  const latestMetrics = useQuery(
    api.manualMetrics.getLatestByPatient,
    isAuthenticated ? {} : "skip",
  );
  const createMetric = useMutation(api.manualMetrics.create);
  const updateMetric = useMutation(api.manualMetrics.update);
  const deleteMetric = useMutation(api.manualMetrics.softDelete);
  const [selectedCatalogId, setSelectedCatalogId] = useState<Id<"metricCatalog"> | null>(null);

  useEffect(() => {
    if (!selectedCatalogId || catalogs === undefined) {
      return;
    }

    const exists = catalogs.some((catalog) => catalog._id === selectedCatalogId);
    if (!exists) {
      setSelectedCatalogId(null);
    }
  }, [catalogs, selectedCatalogId]);

  const selectedCatalog = getSelectedCatalog(catalogs, selectedCatalogId);
  const history = useQuery(
    api.manualMetrics.listByPatientAndCatalog,
    isAuthenticated && selectedCatalog ? { catalogId: selectedCatalog._id } : "skip",
  );

  return (
    <MetricsPageView
      catalogs={catalogs}
      latestMetrics={latestMetrics}
      history={history}
      selectedCatalogId={selectedCatalogId}
      onSelectCatalog={setSelectedCatalogId}
      onCloseSheet={() => setSelectedCatalogId(null)}
      onSubmitMetric={async (args) => {
        await createMetric(args);
      }}
      onUpdateMetric={async (args) => {
        await updateMetric(args);
      }}
      onDeleteMetric={async (args) => {
        await deleteMetric(args);
      }}
    />
  );
}

export {
  EmptyState,
  MetricCatalogCard,
  getChartHistory,
  filterHistoryByRange,
  getMetricDeleteConfirmationMessage,
  MetricDetailsPanel,
  MetricDeleteConfirmationDialog,
  MetricHistoryTable,
  MetricEvolutionChart,
  MetricsPageView,
  formatDateOnly,
  formatDateTime,
  formatRelativeTime,
  getMetricStatus,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
};
