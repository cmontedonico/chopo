import { Outlet, createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <RequireRole roles={["super_admin"]}>
      <Outlet />
    </RequireRole>
  );
}
