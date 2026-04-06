import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@chopo-v1/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@chopo-v1/backend/convex/_generated/api";

import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/invite/$code")({
  component: InviteAcceptancePage,
});

type InvitationLookup = {
  _id: string;
  code: string;
  status: string;
  patientName: string;
};

function InviteStateCard({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {actions ? <CardFooter className="flex flex-wrap gap-2">{actions}</CardFooter> : null}
    </Card>
  );
}

function InviteAcceptancePage() {
  const navigate = useNavigate();
  const { code } = Route.useParams();
  const invitation = useQuery(api.invitations.getByCode, { code }) as
    | InvitationLookup
    | null
    | undefined;
  const acceptInvitation = useMutation(api.invitations.accept);
  const { isLoading, isAuthenticated, role } = useCurrentUser();

  if (invitation === undefined || isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando invitación...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <InviteStateCard
          title="Invitación no encontrada o inválida"
          description="Verifica el código o pide al paciente que comparta un nuevo enlace."
        />
      </div>
    );
  }

  if (invitation.status === "expired") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <InviteStateCard
          title="Invitación expirada"
          description="Esta invitación ha expirado. Pide al paciente que genere una nueva."
        />
      </div>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <InviteStateCard
          title="Invitación ya aceptada"
          description="Esta invitación ya fue aceptada previamente."
          actions={
            <Link
              to="/app/patients"
              className="inline-flex h-8 items-center rounded-none bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              Ir a pacientes
            </Link>
          }
        />
      </div>
    );
  }

  const patientDescription = `Paciente: ${invitation.patientName}`;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <InviteStateCard
          title="Acepta la invitación del paciente"
          description={`${patientDescription}. Debes ser médico registrado para aceptar.`}
          actions={
            <>
              <Link
                to="/login"
                className="inline-flex h-8 items-center rounded-none bg-primary px-3 text-xs font-medium text-primary-foreground"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-8 items-center rounded-none border border-input px-3 text-xs font-medium"
              >
                Crear cuenta
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (role !== "doctor" && role !== "super_admin") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <InviteStateCard
          title="Solo los médicos pueden aceptar invitaciones"
          description={patientDescription}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Aceptar invitación</CardTitle>
          <CardDescription>{patientDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Al aceptar, verás el dashboard, métricas, estudios y perfil del paciente en tu portal.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() =>
              void acceptInvitation({ code })
                .then(() => {
                  toast.success("Invitación aceptada");
                  void navigate({ to: "/app/patients" });
                })
                .catch((error: Error) => {
                  toast.error(error.message);
                })
            }
          >
            Aceptar invitación
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
