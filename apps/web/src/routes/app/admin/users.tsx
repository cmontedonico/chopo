import { createFileRoute } from "@tanstack/react-router";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@chopo-v1/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chopo-v1/ui/components/select";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chopo-v1/ui/components/table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/roles";

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsersPage,
});

type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  createdAt?: string | number | Date | null;
};

type AdminResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

function formatCreatedAt(value: AdminUser["createdAt"]) {
  if (!value) {
    return "Sin fecha";
  }

  return DATE_FORMATTER.format(new Date(value));
}

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [pendingBanUser, setPendingBanUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    void (async () => {
      const result = (await authClient.admin.listUsers({
        query: {},
      })) as unknown as AdminResponse<{ users?: AdminUser[] } | AdminUser[]>;

      if (result.error) {
        toast.error(result.error.message ?? "No se pudieron cargar los usuarios");
        return;
      }

      const nextUsers = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.data?.users)
          ? result.data.users
          : [];

      setUsers(nextUsers);
    })();
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const roleMatches = roleFilter === "todos" || user.role === roleFilter;
        const isBanned = user.banned === true;
        const statusMatches =
          statusFilter === "todos" ||
          (statusFilter === "baneado" && isBanned) ||
          (statusFilter === "activo" && !isBanned);

        return roleMatches && statusMatches;
      }),
    [roleFilter, statusFilter, users],
  );

  const refreshUsers = async () => {
    const result = (await authClient.admin.listUsers({
      query: {},
    })) as unknown as AdminResponse<{ users?: AdminUser[] } | AdminUser[]>;

    const nextUsers = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.data?.users)
        ? result.data.users
        : [];

    setUsers(nextUsers);
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    await authClient.admin.setRole({
      userId,
      role,
    } as never);
    toast.success("Rol actualizado");
    await refreshUsers();
  };

  const handleBan = async () => {
    if (!pendingBanUser) {
      return;
    }

    await authClient.admin.banUser({
      userId: pendingBanUser.id,
    } as never);
    toast.success("Usuario baneado");
    setPendingBanUser(null);
    await refreshUsers();
  };

  const handleUnban = async (userId: string) => {
    await authClient.admin.unbanUser({
      userId,
    } as never);
    toast.success("Usuario habilitado");
    await refreshUsers();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de usuarios</h1>
          <p className="text-muted-foreground">
            Administra roles y acceso para pacientes, médicos y administradores.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Acota la lista por rol o estado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? "todos")}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
              <SelectItem value="doctor">Doctor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "todos")}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="baneado">Baneado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>Lista actual de cuentas registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Fecha registro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay usuarios que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || "Sin nombre"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role ?? "user"}
                        onValueChange={(nextRole) =>
                          void handleRoleChange(user.id, nextRole as Role)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">super_admin</SelectItem>
                          <SelectItem value="user">user</SelectItem>
                          <SelectItem value="doctor">doctor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{formatCreatedAt(user.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={user.banned ? "destructive" : "secondary"}>
                        {user.banned ? "Baneado" : "Activo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleUnban(user.id)}
                        >
                          Desbanear
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setPendingBanUser(user)}>
                          Banear
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={pendingBanUser !== null} onOpenChange={() => setPendingBanUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar baneo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingBanUser
              ? `¿Seguro que quieres banear a ${pendingBanUser.email}?`
              : "¿Seguro que quieres banear a este usuario?"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBanUser(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleBan()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
