import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { submitUploadToBackend, UploadPageView } from "../routes/app/upload";
import { SidebarProvider } from "@chopo-v1/ui/components/sidebar";

describe("upload page", () => {
  test("renders without errors", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <UploadPageView exams={[]} onUpload={async () => undefined} />
      </SidebarProvider>,
    );

    expect(html.includes("Nuevo estudio")).toBe(true);
    expect(html.includes("Historial de estudios")).toBe(true);
  });

  test("shows the empty state when no exams are available", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <UploadPageView exams={[]} onUpload={async () => undefined} />
      </SidebarProvider>,
    );

    expect(html.includes("Aún no has subido estudios. ¡Sube tu primer resultado!")).toBe(true);
  });

  test("submits the upload flow with the expected mutations", async () => {
    const file = new File(["pdf"], "analisis.pdf", { type: "application/pdf" });
    const calls: string[] = [];

    await submitUploadToBackend({
      file,
      labName: "Chopo Sucursal Centro",
      examType: "Biometría hemática",
      notes: "Notas",
      generateUploadUrl: async () => {
        calls.push("generate");
        return "https://upload.example";
      },
      createExam: async (args) => {
        calls.push("create");
        expect(String(args.storageId)).toBe("storage_123");
        expect(args.labName).toBe("Chopo Sucursal Centro");
        expect(args.examType).toBe("Biometría hemática");
        expect(args.fileName).toBe("analisis.pdf");
        expect(args.notes).toBe("Notas");
        expect(typeof args.examDate).toBe("number");
      },
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push("fetch");
        expect(String(input)).toBe("https://upload.example");
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("Content-Type")).toBe("application/pdf");
        expect(init?.body).toBe(file);

        return {
          ok: true,
          json: async () => ({ storageId: "storage_123" }),
        } as Response;
      }) as typeof fetch,
    });

    expect(calls.join(",")).toBe("generate,fetch,create");
  });
});
