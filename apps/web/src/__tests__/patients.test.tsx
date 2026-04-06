import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SidebarProvider } from "@chopo-v1/ui/components/sidebar";

import { PatientsIndexView } from "../routes/app/patients/index";

describe("patients page", () => {
  test("renders the empty state", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <PatientsIndexView patients={[]} />
      </SidebarProvider>,
    );

    expect(html.includes("Aún no tienes pacientes")).toBe(true);
    expect(html.includes("Pide a tus pacientes que compartan su historial contigo.")).toBe(true);
  });

  test("renders assigned patients", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <PatientsIndexView
          patients={[
            {
              patientId: "patient_1",
              name: "Paciente Uno",
              email: "patient@example.com",
              totalExams: 4,
              lastExamDate: Date.now(),
            },
          ]}
        />
      </SidebarProvider>,
    );

    expect(html.includes("Paciente Uno")).toBe(true);
    expect(html.includes("patient@example.com")).toBe(true);
    expect(html.includes("Total de estudios: 4")).toBe(true);
  });
});
