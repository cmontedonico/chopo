import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@chopo-v1/ui/components/avatar";
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
import { Separator } from "@chopo-v1/ui/components/separator";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import { AlertTriangle, CheckCircle, Heart, Network, Shield, User } from "lucide-react";
import { Cell, Pie, PieChart, RadialBar, RadialBarChart } from "recharts";

import { BLOOD_TEST_RESULTS, CORRELATIONS, USER_PROFILE, type Correlation } from "@/lib/mock-data";

export const Route = createFileRoute("/app/correlations")({
  component: CorrelationsPage,
});

const RISK_CONFIG: Record<
  Correlation["risk"],
  { color: string; icon: typeof CheckCircle; label: string }
> = {
  low: { color: "text-emerald-500", icon: CheckCircle, label: "Riesgo bajo" },
  moderate: { color: "text-amber-500", icon: AlertTriangle, label: "Riesgo moderado" },
  high: { color: "text-red-500", icon: Heart, label: "Riesgo alto" },
};

function ProfileCard() {
  const bmi = (USER_PROFILE.weight / (USER_PROFILE.height / 100) ** 2).toFixed(1);
  const bmiCategory =
    Number(bmi) < 18.5
      ? "Bajo peso"
      : Number(bmi) < 25
        ? "Normal"
        : Number(bmi) < 30
          ? "Sobrepeso"
          : "Obesidad";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Perfil del paciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {USER_PROFILE.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-1">
            <h3 className="text-lg font-semibold">{USER_PROFILE.name}</h3>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{USER_PROFILE.age} años</span>
              <span>·</span>
              <span>{USER_PROFILE.sex}</span>
              <span>·</span>
              <span>Tipo {USER_PROFILE.bloodType}</span>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Peso</p>
            <p className="text-lg font-semibold">{USER_PROFILE.weight} kg</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estatura</p>
            <p className="text-lg font-semibold">{USER_PROFILE.height} cm</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">IMC</p>
            <p className="text-lg font-semibold">{bmi}</p>
            <p className="text-xs text-muted-foreground">{bmiCategory}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Condiciones</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {USER_PROFILE.conditions.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthScoreChart() {
  const total = BLOOD_TEST_RESULTS.length;
  const normal = BLOOD_TEST_RESULTS.filter((r) => r.status === "normal").length;
  const score = Math.round((normal / total) * 100);

  const chartConfig: ChartConfig = {
    score: { label: "Salud general", color: "var(--chart-1)" },
  };

  const data = [{ name: "Score", value: score, fill: "var(--chart-1)" }];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Índice de salud general
        </CardTitle>
        <CardDescription>Basado en tus últimos resultados</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              fill="var(--chart-1)"
              background={{ fill: "var(--muted)" }}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="-mt-16 text-center">
          <p className="text-4xl font-bold">{score}%</p>
          <p className="text-sm text-muted-foreground">
            {score >= 90
              ? "Excelente"
              : score >= 75
                ? "Bueno"
                : score >= 60
                  ? "Regular"
                  : "Atención"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskDistributionChart() {
  const lowCount = CORRELATIONS.filter((c) => c.risk === "low").length;
  const modCount = CORRELATIONS.filter((c) => c.risk === "moderate").length;
  const highCount = CORRELATIONS.filter((c) => c.risk === "high").length;

  const data = [
    { name: "Bajo", value: lowCount, fill: "oklch(0.7 0.15 155)" },
    { name: "Moderado", value: modCount, fill: "oklch(0.75 0.15 85)" },
    { name: "Alto", value: highCount, fill: "oklch(0.65 0.2 25)" },
  ].filter((d) => d.value > 0);

  const chartConfig: ChartConfig = {
    low: { label: "Bajo", color: "oklch(0.7 0.15 155)" },
    moderate: { label: "Moderado", color: "oklch(0.75 0.15 85)" },
    high: { label: "Alto", color: "oklch(0.65 0.2 25)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          Distribución de riesgo
        </CardTitle>
        <CardDescription>{CORRELATIONS.length} correlaciones detectadas</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>
        <div className="flex gap-4 text-sm">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.fill }} />
              <span>
                {d.name}: {d.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CorrelationCard({ correlation }: { correlation: Correlation }) {
  const config = RISK_CONFIG[correlation.risk];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{correlation.title}</CardTitle>
          <Badge
            variant={
              correlation.risk === "low"
                ? "secondary"
                : correlation.risk === "high"
                  ? "destructive"
                  : "outline"
            }
            className="gap-1"
          >
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{correlation.description}</p>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Estudios relacionados</p>
          <div className="flex flex-wrap gap-1">
            {correlation.relatedTests.map((test) => {
              const result = BLOOD_TEST_RESULTS.find((r) => r.name === test);
              return (
                <Badge key={test} variant="outline" className="text-xs">
                  {test}: {result?.value} {result?.unit}
                </Badge>
              );
            })}
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium text-muted-foreground">Recomendación</p>
          <p className="mt-1 text-sm">{correlation.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CorrelationsPage() {
  const riskOrder: Correlation["risk"][] = ["high", "moderate", "low"];
  const sorted = [...CORRELATIONS].sort(
    (a, b) => riskOrder.indexOf(a.risk) - riskOrder.indexOf(b.risk),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Correlaciones</h1>
          <p className="text-muted-foreground">
            Análisis de correlaciones entre tus resultados, perfil y factores de riesgo
          </p>
        </div>
      </div>

      <ProfileCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <HealthScoreChart />
        <RiskDistributionChart />
      </div>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Correlaciones detectadas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((correlation) => (
            <CorrelationCard key={correlation.id} correlation={correlation} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factores de riesgo por edad</CardTitle>
          <CardDescription>
            Basado en tu edad ({USER_PROFILE.age} años) y sexo ({USER_PROFILE.sex})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: "Riesgo cardiovascular", value: 25, desc: "Moderado para tu rango de edad" },
              { label: "Diabetes tipo 2", value: 15, desc: "Bajo — glucosa y HbA1c en rango" },
              { label: "Enfermedad renal", value: 5, desc: "Muy bajo — función renal normal" },
              {
                label: "Enfermedad hepática",
                value: 8,
                desc: "Bajo — marcadores hepáticos normales",
              },
              { label: "Osteoporosis", value: 10, desc: "Bajo — calcio y vitamina D adecuados" },
            ].map((risk) => (
              <div key={risk.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{risk.label}</span>
                  <span className="text-muted-foreground">{risk.value}%</span>
                </div>
                <Progress value={risk.value} className="h-2" />
                <p className="text-xs text-muted-foreground">{risk.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
