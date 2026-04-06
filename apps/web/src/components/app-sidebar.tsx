import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@chopo-v1/ui/components/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@chopo-v1/ui/components/sidebar";
import {
  Activity,
  FileUp,
  LayoutDashboard,
  LogOut,
  Network,
  Share2,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
} from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { authClient } from "@/lib/auth-client";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/profile", label: "Mi perfil", icon: User },
  { to: "/app/upload", label: "Subir resultados", icon: FileUp, roles: ["user", "super_admin"] },
  {
    to: "/app/correlations",
    label: "Correlaciones",
    icon: Network,
    roles: ["user", "super_admin"],
  },
  {
    to: "/app/metrics",
    label: "Métricas",
    icon: Activity,
    roles: ["user", "super_admin"],
  },
  {
    to: "/app/share",
    label: "Compartir",
    icon: Share2,
    roles: ["user"],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/app/admin/users", label: "Gestión de usuarios", icon: Users, roles: ["super_admin"] },
  { to: "/app/admin/roles", label: "Roles y permisos", icon: ShieldCheck, roles: ["super_admin"] },
];

const DOCTOR_ITEMS: NavItem[] = [
  { to: "/app/patients", label: "Pacientes", icon: Stethoscope, roles: ["doctor", "super_admin"] },
];

function filterByRole(items: NavItem[], role: Role | null): NavItem[] {
  return items.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

export function AppSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  const { user, role } = useCurrentUser();

  const visibleNav = filterByRole(NAV_ITEMS, role);
  const visibleAdmin = filterByRole(ADMIN_ITEMS, role);
  const visibleDoctor = filterByRole(DOCTOR_ITEMS, role);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
    : "??";

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate({ to: "/login" }),
      },
    });
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/app" />}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="h-4 w-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Chopo Health</span>
                <span className="truncate text-xs text-muted-foreground">Panel médico</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    isActive={currentPath === item.to}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleDoctor.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Clínica</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleDoctor.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={currentPath === item.to}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={currentPath === item.to}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.name ?? "..."}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {role ? ROLE_LABELS[role] : "..."}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
