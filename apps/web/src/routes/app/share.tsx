import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@chopo-v1/ui/components/badge";
import { Button } from "@chopo-v1/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import { Separator } from "@chopo-v1/ui/components/separator";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chopo-v1/ui/components/table";
import { Copy, Link2, Share2, Trash2, UserRoundX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "@chopo-v1/backend/convex/_generated/api";

import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/app/share")({
  component: SharePage,
});

type InvitationRecord = {
  _id: string;
  code: string;
  status: string;
  expiresAt: number;
  createdAt: number;
  acceptedByDoctorId?: string;
  connectedAt: number | null;
  doctor: {
    id: string;
    name: string;
    email: string;
  } | null;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  accepted: {
    label: "Aceptada",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  expired: {
    label: "Expirada",
    className: "bg-muted text-muted-foreground",
  },
  revoked: {
    label: "Revocada",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

function formatDate(timestamp: number | null) {
  if (timestamp === null) {
    return "Sin fecha";
  }

  return DATE_FORMATTER.format(new Date(timestamp));
}

function copyText(value: string, message: string) {
  return navigator.clipboard.writeText(value).then(() => {
    toast.success(message);
  });
}

export function SharePageView({
  invitations,
  latestInvite,
  onGenerate,
  onRevoke,
  onDisconnect,
}: {
  invitations: InvitationRecord[] | undefined;
  latestInvite: InvitationRecord | null;
  onGenerate: () => Promise<void>;
  onRevoke: (invitationId: string) => Promise<void>;
  onDisconnect: (doctorId: string) => Promise<void>;
}) {
  const connectedDoctors = useMemo(
    () =>
      (invitations ?? []).filter(
        (invitation) =>
          invitation.status === "accepted" &&
          invitation.doctor !== null &&
          invitation.acceptedByDoctorId,
      ),
    [invitations],
  );

  const inviteUrl =
    latestInvite === null
      ? ""
      : `${typeof window !== "undefined" ? window.location.origin : "https://chopo.health"}/invite/${latestInvite.code}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compartir con tu médico</h1>
          <p className="text-muted-foreground">
            Genera códigos temporales para que tu médico vea tu historial.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar invitación</CardTitle>
          <CardDescription>
            Comparte el código o el enlace para conectar tu cuenta con un médico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void onGenerate()}>
            <Share2 className="mr-2 h-4 w-4" />
            Generar código de invitación
          </Button>

          {latestInvite ? (
            <Card className="border-dashed">
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Código activo</p>
                  <p className="font-mono text-2xl font-semibold tracking-widest">
                    {latestInvite.code}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void copyText(latestInvite.code, "Código copiado")}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar código
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void copyText(inviteUrl, "Enlace copiado")}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Copiar enlace
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (navigator.share) {
                        void navigator
                          .share({
                            title: "Invitación de Chopo Health",
                            text: `Usa este código para conectarte: ${latestInvite.code}`,
                            url: inviteUrl,
                          })
                          .catch(() => undefined);
                        return;
                      }

                      void copyText(inviteUrl, "Enlace copiado");
                    }}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Compartir
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Este código expira en 7 días. Enlace: {inviteUrl}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitaciones</CardTitle>
          <CardDescription>Historial de códigos generados y su estado actual.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invitations ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aún no has generado invitaciones.
                  </TableCell>
                </TableRow>
              ) : (
                (invitations ?? []).map((invitation) => {
                  const statusMeta = STATUS_META[invitation.status] ?? {
                    label: invitation.status,
                    className: "bg-muted text-muted-foreground",
                  };

                  return (
                    <TableRow key={invitation._id}>
                      <TableCell className="font-mono">{invitation.code}</TableCell>
                      <TableCell>
                        <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                      <TableCell>{invitation.doctor?.name ?? "Sin asignar"}</TableCell>
                      <TableCell className="text-right">
                        {invitation.status === "pending" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void onRevoke(invitation._id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revocar
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin acciones</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Médicos conectados</CardTitle>
          <CardDescription>Relaciones activas que pueden acceder a tu historial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectedDoctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no tienes médicos conectados.</p>
          ) : (
            connectedDoctors.map((invitation) => (
              <Card key={`${invitation._id}-doctor`}>
                <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{invitation.doctor?.name}</p>
                    <p className="text-sm text-muted-foreground">{invitation.doctor?.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Conectado desde {formatDate(invitation.connectedAt ?? invitation.createdAt)}
                    </p>
                  </div>
                  {invitation.acceptedByDoctorId ? (
                    <Button
                      variant="outline"
                      onClick={() => void onDisconnect(invitation.acceptedByDoctorId!)}
                    >
                      <UserRoundX className="mr-2 h-4 w-4" />
                      Desconectar
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SharePage() {
  const { user } = useCurrentUser();
  const invitations = useQuery(api.invitations.listByPatient, {}) as InvitationRecord[] | undefined;
  const generateInvitation = useMutation(api.invitations.generate);
  const revokeInvitation = useMutation(api.invitations.revoke);
  const disconnectDoctor = useMutation(api.patients.removeFromDoctor);
  const [latestCode, setLatestCode] = useState<string | null>(null);

  const latestInvite =
    invitations?.find((invitation) => invitation.code === latestCode) ??
    invitations?.find((invitation) => invitation.status === "pending") ??
    null;

  return (
    <SharePageView
      invitations={invitations}
      latestInvite={latestInvite}
      onGenerate={async () => {
        const result = await generateInvitation({});
        setLatestCode(result.code);
        toast.success("Código generado");
      }}
      onRevoke={async (invitationId) => {
        if (!window.confirm("¿Quieres revocar esta invitación?")) {
          return;
        }

        await revokeInvitation({ invitationId: invitationId as never });
        toast.success("Invitación revocada");
      }}
      onDisconnect={async (doctorAuthUserId) => {
        if (!user?._id) {
          toast.error("No se pudo identificar al paciente actual");
          return;
        }

        if (!window.confirm("¿Quieres desconectar a este médico?")) {
          return;
        }

        await disconnectDoctor({
          doctorAuthUserId,
          patientAuthUserId: user._id,
        });
        toast.success("Médico desconectado");
      }}
    />
  );
}
