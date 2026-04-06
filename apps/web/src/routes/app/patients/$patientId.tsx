import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@chopo-v1/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chopo-v1/ui/components/table";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Id } from "@chopo-v1/backend/convex/_generated/dataModel";
import { api } from "@chopo-v1/backend/convex/_generated/api";

import { DashboardPageView, reconcileComparisonSelections } from "@/routes/app/index";

export const Route = createFileRoute("/app/patients/$patientId")({
  component: PatientDetailPage,
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

type ExamRecord = {
  _id: Id<"exams">;
  examType: string;
  examDate: number;
  status: string;
};

type DoctorPatientRecord = {
  patientId: string;
  name: string;
  email: string;
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

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

function formatDate(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "Sin dato";
  }

  return DATE_FORMATTER.format(new Date(timestamp));
}

function ReadOnlyValue({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="space-y-1 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "Sin dato"}</p>
    </div>
  );
}

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTest, setSelectedTest] = useState("Glucosa");
  const [selectedExamA, setSelectedExamA] = useState("");
  const [selectedExamB, setSelectedExamB] = useState("");
  const summary = useQuery(getDashboardSummaryRef, { patientId });
  const keyMetrics = useQuery(getDashboardKeyMetricsRef, { patientId });
  const allResults = useQuery(getDashboardResultsRef, { patientId });
  const filteredResults = useQuery(
    getDashboardResultsRef,
    selectedCategory === "all" ? { patientId } : { patientId, category: selectedCategory },
  );
  const history = useQuery(getDashboardHistoryRef, { patientId, testName: selectedTest });
  const exams = useQuery(api.exams.listByPatient, { patientId }) as ExamRecord[] | undefined;
  const manualMetrics = useQuery(api.manualMetrics.getLatestByPatient, { patientId });
  const patientProfile = useQuery(api.patientProfile.getByPatient, { patientId });
  const patients = useQuery(api.patients.listByDoctor, {}) as DoctorPatientRecord[] | undefined;

  const patient = patients?.find((entry) => entry.patientId === patientId);
  const comparisonSelections = useMemo(
    () => reconcileComparisonSelections(exams, selectedExamA, selectedExamB),
    [exams, selectedExamA, selectedExamB],
  );
  const comparisonResultsA = useQuery(
    api.testResults.listByExam,
    comparisonSelections.selectedExamA
      ? { examId: comparisonSelections.selectedExamA as Id<"exams"> }
      : "skip",
  );
  const comparisonResultsB = useQuery(
    api.testResults.listByExam,
    comparisonSelections.selectedExamB
      ? { examId: comparisonSelections.selectedExamB as Id<"exams"> }
      : "skip",
  );

  const categories = useMemo(() => {
    if (!allResults) {
      return [];
    }

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
    if (selectedCategory !== "all" && !categories.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [categories, selectedCategory]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link
          to="/app/patients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{patient?.name ?? patientId}</h1>
          <p className="text-muted-foreground">{patient?.email ?? "Paciente asignado"}</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="exams">Estudios</TabsTrigger>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
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
            selectedExamA={comparisonSelections.selectedExamA}
            selectedExamB={comparisonSelections.selectedExamB}
            onExamAChange={setSelectedExamA}
            onExamBChange={setSelectedExamB}
            comparisonResultsA={comparisonResultsA}
            comparisonResultsB={comparisonResultsB}
          />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(manualMetrics ?? []).map((metric) => (
              <Card key={metric.catalog._id}>
                <CardHeader>
                  <CardTitle>{metric.catalog.name}</CardTitle>
                  <CardDescription>{metric.catalog.unit}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {metric.latestValue === null ? "Sin registro" : `${metric.latestValue}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Última lectura: {formatDate(metric.latestDate)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Estudios del paciente</CardTitle>
              <CardDescription>Historial clínico disponible para consulta.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(exams ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No hay estudios disponibles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (exams ?? []).map((exam) => (
                      <TableRow key={exam._id}>
                        <TableCell>{exam.examType}</TableCell>
                        <TableCell>{formatDate(exam.examDate)}</TableCell>
                        <TableCell>{exam.status}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyValue label="Edad" value={patientProfile?.age} />
            <ReadOnlyValue label="Sexo" value={patientProfile?.sex} />
            <ReadOnlyValue label="Tipo de sangre" value={patientProfile?.bloodType} />
            <ReadOnlyValue label="Peso" value={patientProfile?.weight} />
            <ReadOnlyValue label="Altura" value={patientProfile?.height} />
            <ReadOnlyValue label="Condiciones" value={patientProfile?.conditions?.join(", ")} />
            <ReadOnlyValue label="Medicamentos" value={patientProfile?.medications?.join(", ")} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
