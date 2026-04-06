import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SidebarProvider } from "@chopo-v1/ui/components/sidebar";

import { SharePageView } from "../routes/app/share";

describe("share page", () => {
  test("renders the empty states", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SharePageView
          invitations={[]}
          latestInvite={null}
          onGenerate={async () => undefined}
          onRevoke={async () => undefined}
          onDisconnect={async () => undefined}
        />
      </SidebarProvider>,
    );

    expect(html.includes("Compartir con tu médico")).toBe(true);
    expect(html.includes("Aún no has generado invitaciones.")).toBe(true);
    expect(html.includes("Todavía no tienes médicos conectados.")).toBe(true);
  });

  test("renders an active code and accepted doctor rows", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SharePageView
          invitations={[
            {
              _id: "invitation_1",
              code: "ABCD1234",
              status: "pending",
              expiresAt: Date.now(),
              createdAt: Date.now(),
              connectedAt: null,
              doctor: null,
            },
            {
              _id: "invitation_2",
              code: "ZXCV5678",
              status: "accepted",
              expiresAt: Date.now(),
              createdAt: Date.now(),
              connectedAt: Date.now(),
              acceptedByDoctorId: "doctor_1",
              doctor: {
                id: "doctor_1",
                name: "Dra. Rivera",
                email: "rivera@example.com",
              },
            },
          ]}
          latestInvite={{
            _id: "invitation_1",
            code: "ABCD1234",
            status: "pending",
            expiresAt: Date.now(),
            createdAt: Date.now(),
            connectedAt: null,
            doctor: null,
          }}
          onGenerate={async () => undefined}
          onRevoke={async () => undefined}
          onDisconnect={async () => undefined}
        />
      </SidebarProvider>,
    );

    expect(html.includes("ABCD1234")).toBe(true);
    expect(html.includes("Dra. Rivera")).toBe(true);
    expect(html.includes("Desconectar")).toBe(true);
  });
});
