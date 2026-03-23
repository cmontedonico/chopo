import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@chopo-v1/ui/components/sidebar";

import { AppSidebar } from "@/components/app-sidebar";
import { RequireRole } from "@/components/require-role";
import { ROLES } from "@/lib/roles";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireRole roles={[...ROLES]} redirectTo="/login">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RequireRole>
  );
}
