import { test, expect } from "./fixtures";

test.describe("Share page — patient invitation flow", () => {
  test("displays the share page heading and empty state", async ({ patientPage: page }) => {
    await page.goto("/app/share");

    await expect(page.getByRole("heading", { name: "Compartir con tu médico" })).toBeVisible();
    await expect(page.getByText("Genera códigos temporales")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Generar invitación" })).toBeVisible();

    await expect(page.getByRole("button", { name: /Generar código de invitación/ })).toBeVisible();
  });

  test("generates an invitation code and displays it", async ({ patientPage: page }) => {
    await page.goto("/app/share");

    await page.getByRole("button", { name: /Generar código de invitación/ }).click();

    // The active-code card should appear with a monospace code
    const codeText = page.locator("text=Código activo").first();
    await expect(codeText).toBeVisible({ timeout: 10_000 });

    // The 8-character alphanumeric code should be rendered
    const codeEl = page.locator(".font-mono.text-2xl");
    await expect(codeEl).toBeVisible();
    const code = await codeEl.textContent();
    expect(code).toBeTruthy();
    expect(code!.trim()).toMatch(/^[A-Z0-9]{8}$/);

    // Copy and share buttons should appear
    await expect(page.getByRole("button", { name: /Copiar código/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copiar enlace/ })).toBeVisible();

    // Expiry hint should be visible
    await expect(page.getByText(/Este código expira en 7 días/)).toBeVisible();
  });

  test("new invitation appears in the invitations table", async ({ patientPage: page }) => {
    await page.goto("/app/share");

    await page.getByRole("button", { name: /Generar código de invitación/ }).click();

    // Wait for the active code card to appear
    await expect(page.locator("text=Código activo").first()).toBeVisible({ timeout: 10_000 });

    // The invitations table should contain at least one row with a "Pendiente" badge
    const invitationsTable = page.getByRole("heading", { name: "Invitaciones" }).locator("..");
    await expect(invitationsTable).toBeVisible();

    const pendingBadge = page.getByText("Pendiente").first();
    await expect(pendingBadge).toBeVisible();
  });

  test("revokes a pending invitation", async ({ patientPage: page }) => {
    await page.goto("/app/share");

    // Generate an invitation first
    await page.getByRole("button", { name: /Generar código de invitación/ }).click();
    await expect(page.locator("text=Código activo").first()).toBeVisible({ timeout: 10_000 });

    // Click the Revocar button in the table
    page.once("dialog", (dialog) => void dialog.accept());
    await page
      .getByRole("button", { name: /Revocar/ })
      .first()
      .click();

    // The invitation status should change to "Revocada"
    await expect(page.getByText("Revocada").first()).toBeVisible({ timeout: 10_000 });
  });

  test("connected doctors section shows empty state when no doctors are connected", async ({
    patientPage: page,
  }) => {
    await page.goto("/app/share");

    await expect(page.getByRole("heading", { name: "Médicos conectados" })).toBeVisible();
    await expect(page.getByText("Todavía no tienes médicos conectados")).toBeVisible();
  });
});
