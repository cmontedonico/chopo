import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Role } from "@/lib/roles";

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RequireRole({
  roles,
  children,
  fallback,
  redirectTo = "/app",
}: RequireRoleProps) {
  const { role, isLoading, isAuthenticated } = useCurrentUser();
  const navigate = useNavigate();

  const unauthorized = !isLoading && !isAuthenticated;
  const forbidden = !isLoading && isAuthenticated && (!role || !roles.includes(role));

  useEffect(() => {
    if (unauthorized) {
      navigate({ to: "/login" });
    }
    if (forbidden && !fallback) {
      navigate({ to: redirectTo });
    }
  }, [unauthorized, forbidden, fallback, navigate, redirectTo]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (unauthorized) {
    return null;
  }

  if (forbidden) {
    if (fallback) return <>{fallback}</>;
    return null;
  }

  return <>{children}</>;
}
