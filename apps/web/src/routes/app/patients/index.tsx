import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";

import { api } from "@chopo-v1/backend/convex/_generated/api";

export const Route = createFileRoute("/app/patients/")({
  component: PatientsIndexPage,
});

type DoctorPatientRecord = {
  patientId: string;
  name: string;
  email: string;
  totalExams: number;
  lastExamDate: number | null;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

function formatDate(timestamp: number | null) {
  if (timestamp === null) {
    return "Sin estudios";
  }

  return DATE_FORMATTER.format(new Date(timestamp));
}

export function PatientsIndexView({ patients }: { patients: DoctorPatientRecord[] | undefined }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground">Accede al historial de tus pacientes asignados.</p>
        </div>
      </div>

      {!patients || patients.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no tienes pacientes</CardTitle>
            <CardDescription>
              Pide a tus pacientes que compartan su historial contigo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => (
            <Card key={patient.patientId}>
              <CardHeader>
                <CardTitle>{patient.name}</CardTitle>
                <CardDescription>{patient.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Último estudio: {formatDate(patient.lastExamDate)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total de estudios: {patient.totalExams}
                </div>
                <a
                  href={`/app/patients/${patient.patientId}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Ver detalle
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientsIndexPage() {
  const patients = useQuery(api.patients.listByDoctor, {}) as DoctorPatientRecord[] | undefined;

  return <PatientsIndexView patients={patients} />;
}
