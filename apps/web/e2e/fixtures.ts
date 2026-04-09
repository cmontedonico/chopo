import { test as base, type Page } from "@playwright/test";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Role = "user" | "doctor" | "super_admin";

export interface TestUser {
  email: string;
  password: string;
  role: Role;
}

/* ------------------------------------------------------------------ */
/*  Default test accounts                                              */
/* ------------------------------------------------------------------ */

/**
 * Default credentials consumed by the E2E suite.
 *
 * Override per-environment with the E2E_PATIENT_EMAIL / E2E_PATIENT_PASSWORD
 * and E2E_DOCTOR_EMAIL / E2E_DOCTOR_PASSWORD environment variables.
 */
export const TEST_PATIENT: TestUser = {
  email: process.env.E2E_PATIENT_EMAIL ?? "patient-e2e@chopo.health",
  password: process.env.E2E_PATIENT_PASSWORD ?? "Test1234!",
  role: "user",
};

export const TEST_DOCTOR: TestUser = {
  email: process.env.E2E_DOCTOR_EMAIL ?? "doctor-e2e@chopo.health",
  password: process.env.E2E_DOCTOR_PASSWORD ?? "Test1234!",
  role: "doctor",
};

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Log in via the /login form and wait until the app redirects away.
 */
export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

/**
 * Log out by calling the Better-Auth sign-out endpoint via the browser
 * context so cookies are properly cleared.
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
  });
  await page.goto("/login");
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

type Fixtures = {
  /** A page already logged in as the test patient. */
  patientPage: Page;
  /** A page already logged in as the test doctor. */
  doctorPage: Page;
};

export const test = base.extend<Fixtures>({
  patientPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, TEST_PATIENT);
    await use(page);
    await ctx.close();
  },

  doctorPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, TEST_DOCTOR);
    await use(page);
    await ctx.close();
  },
});

export { expect } from "@playwright/test";
