import { Outlet, createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/app/patients")({
  component: PatientsLayout,
});

function PatientsLayout() {
  return (
    <RequireRole roles={["doctor", "super_admin"]}>
      <Outlet />
    </RequireRole>
  );
}
