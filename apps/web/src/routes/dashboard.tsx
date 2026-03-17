import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "@chopo-v1/backend/convex/_generated/api";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useEffect } from "react";

import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RedirectToLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/login" });
  }, [navigate]);

  return null;
}

function RouteComponent() {
  const privateData = useQuery(api.privateData.get);

  return (
    <>
      <Authenticated>
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">privateData: {privateData?.message}</p>
          <UserMenu />
        </div>
      </Authenticated>
      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>
      <AuthLoading>
        <div className="flex min-h-svh items-center justify-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </AuthLoading>
    </>
  );
}
