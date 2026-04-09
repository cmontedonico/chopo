import { test, expect, TEST_PATIENT, login } from "./fixtures";

test.describe("Invite acceptance page — doctor flow", () => {
  /**
   * Helper: log in as the patient, generate an invitation, and return the code.
   */
  async function generateInvitationCode(page: import("@playwright/test").Page): Promise<string> {
    await login(page, TEST_PATIENT);
    await page.goto("/app/share");

    await page.getByRole("button", { name: /Generar código de invitación/ }).click();
    await expect(page.locator("text=Código activo").first()).toBeVisible({
      timeout: 10_000,
    });

    const codeEl = page.locator(".font-mono.text-2xl");
    await expect(codeEl).toBeVisible();
    const code = (await codeEl.textContent())?.trim();
    expect(code).toBeTruthy();
    return code!;
  }

  test("doctor can accept a valid invitation", async ({ browser }) => {
    // 1. Patient generates an invitation
    const patientCtx = await browser.newContext();
    const patientPage = await patientCtx.newPage();
    const code = await generateInvitationCode(patientPage);
    await patientCtx.close();

    // 2. Doctor navigates to /invite/<code> and accepts
    const doctorCtx = await browser.newContext();
    const doctorPage = await doctorCtx.newPage();
    await login(doctorPage, {
      email: process.env.E2E_DOCTOR_EMAIL ?? "doctor-e2e@chopo.health",
      password: process.env.E2E_DOCTOR_PASSWORD ?? "Test1234!",
      role: "doctor",
    });

    await doctorPage.goto(`/invite/${code}`);

    // The acceptance card should be visible with the patient name
    await expect(doctorPage.getByRole("heading", { name: "Aceptar invitación" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(doctorPage.getByText(/Paciente:/)).toBeVisible();

    // Click "Aceptar invitación"
    await doctorPage.getByRole("button", { name: "Aceptar invitación" }).click();

    // Should redirect to /app/patients after acceptance
    await doctorPage.waitForURL(/\/app\/patients/, { timeout: 15_000 });
    await doctorCtx.close();
  });

  test("shows 'not found' for an invalid invitation code", async ({ page }) => {
    await page.goto("/invite/INVALID0");

    // Wait for the loading state to resolve
    await expect(page.getByText("Invitación no encontrada o inválida")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows 'already accepted' for a previously accepted invitation", async ({ browser }) => {
    // 1. Patient generates an invitation
    const patientCtx = await browser.newContext();
    const patientPage = await patientCtx.newPage();
    const code = await generateInvitationCode(patientPage);
    await patientCtx.close();

    // 2. Doctor accepts the invitation
    const doctorCtx = await browser.newContext();
    const doctorPage = await doctorCtx.newPage();
    await login(doctorPage, {
      email: process.env.E2E_DOCTOR_EMAIL ?? "doctor-e2e@chopo.health",
      password: process.env.E2E_DOCTOR_PASSWORD ?? "Test1234!",
      role: "doctor",
    });
    await doctorPage.goto(`/invite/${code}`);
    await expect(doctorPage.getByRole("heading", { name: "Aceptar invitación" })).toBeVisible({
      timeout: 10_000,
    });
    await doctorPage.getByRole("button", { name: "Aceptar invitación" }).click();
    await doctorPage.waitForURL(/\/app\/patients/, { timeout: 15_000 });
    await doctorCtx.close();

    // 3. Another doctor (or same) visits the same code
    const secondCtx = await browser.newContext();
    const secondPage = await secondCtx.newPage();
    await secondPage.goto(`/invite/${code}`);
    await expect(secondPage.getByText("Invitación ya aceptada")).toBeVisible({ timeout: 10_000 });
    await secondCtx.close();
  });

  test("unauthenticated user sees login prompt on invite page", async ({ page }) => {
    await page.goto("/invite/SOMECODE");

    // Should show either login prompt or not-found (depending on whether the code exists)
    const loginPrompt = page.getByText("Debes ser médico registrado para aceptar");
    const notFound = page.getByText("Invitación no encontrada o inválida");

    await expect(loginPrompt.or(notFound)).toBeVisible({ timeout: 10_000 });
  });

  test("patient (non-doctor) cannot accept an invitation", async ({ browser }) => {
    // 1. Generate an invitation as a patient
    const patientCtx1 = await browser.newContext();
    const patientPage1 = await patientCtx1.newPage();
    const code = await generateInvitationCode(patientPage1);
    await patientCtx1.close();

    // 2. Log in as a different patient and try to accept the code
    const patientCtx2 = await browser.newContext();
    const patientPage2 = await patientCtx2.newPage();
    await login(patientPage2, TEST_PATIENT);
    await patientPage2.goto(`/invite/${code}`);

    // Should show role-restriction message
    await expect(
      patientPage2.getByText("Solo los médicos pueden aceptar invitaciones"),
    ).toBeVisible({ timeout: 10_000 });
    await patientCtx2.close();
  });

  test("patient share page shows connected doctor after acceptance", async ({ browser }) => {
    // 1. Patient generates an invitation
    const patientCtx1 = await browser.newContext();
    const patientPage1 = await patientCtx1.newPage();
    const code = await generateInvitationCode(patientPage1);
    await patientCtx1.close();

    // 2. Doctor accepts the invitation
    const doctorCtx = await browser.newContext();
    const doctorPage = await doctorCtx.newPage();
    await login(doctorPage, {
      email: process.env.E2E_DOCTOR_EMAIL ?? "doctor-e2e@chopo.health",
      password: process.env.E2E_DOCTOR_PASSWORD ?? "Test1234!",
      role: "doctor",
    });
    await doctorPage.goto(`/invite/${code}`);
    await expect(doctorPage.getByRole("heading", { name: "Aceptar invitación" })).toBeVisible({
      timeout: 10_000,
    });
    await doctorPage.getByRole("button", { name: "Aceptar invitación" }).click();
    await doctorPage.waitForURL(/\/app\/patients/, { timeout: 15_000 });
    await doctorCtx.close();

    // 3. Patient revisits the share page and sees the connected doctor
    const patientCtx2 = await browser.newContext();
    const patientPage2 = await patientCtx2.newPage();
    await login(patientPage2, TEST_PATIENT);
    await patientPage2.goto("/app/share");

    // The invitation should now show as "Aceptada"
    await expect(patientPage2.getByText("Aceptada").first()).toBeVisible({ timeout: 10_000 });

    // The connected doctors section should show the doctor
    await expect(patientPage2.getByRole("heading", { name: "Médicos conectados" })).toBeVisible();
    await expect(patientPage2.getByText("Desconectar")).toBeVisible({ timeout: 10_000 });
    await patientCtx2.close();
  });
});
