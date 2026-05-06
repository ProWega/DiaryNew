import { test, expect, dismissJourneyStageOnboarding } from "./fixtures";

test.describe("navigation", () => {
  test("unknown route without auth redirects to /register", async ({ page }) => {
    await page.goto("/some/random/path");
    await expect(page).toHaveURL(/\/register$/);
  });

  test("participant nav-pills navigate between today / self / dynamics", async ({ page }) => {
    // Register
    await page.goto("/register");
    await page.getByPlaceholder("Имя и фамилия").fill("Навигатор Тест");
    await page.locator(".registration-option").first().click();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page).toHaveURL(/\/today$/);

    // Methodology v4 onboarding modal blocks pointer events — dismiss before navigating.
    await dismissJourneyStageOnboarding(page);

    // Click "Узнать себя"
    await page.getByRole("link", { name: "Узнать себя" }).click();
    await expect(page).toHaveURL(/\/self$/);

    // Click "Динамика"
    await page.getByRole("link", { name: "Динамика" }).click();
    await expect(page).toHaveURL(/\/dynamics$/);

    // Back to "Состояние"
    await page.getByRole("link", { name: "Состояние" }).click();
    await expect(page).toHaveURL(/\/today$/);
  });
});
