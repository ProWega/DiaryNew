import { test, expect } from "./fixtures";

test.describe("smoke", () => {
  test("loads root and redirects to /register when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/register$/);
  });

  test("registration page shows the form and the brand heading", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Выберите событие");
    await expect(page.getByPlaceholder("Имя и фамилия")).toBeVisible();
    await expect(page.getByRole("button", { name: "Зарегистрироваться" })).toBeVisible();
  });

  test("submit is disabled until both name and event are filled", async ({ page }) => {
    await page.goto("/register");
    const submit = page.getByRole("button", { name: "Зарегистрироваться" });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder("Имя и фамилия").fill("Тест Иванов");
    await expect(submit).toBeDisabled();

    // Pick the first registration option card
    await page.locator(".registration-option").first().click();
    await expect(submit).toBeEnabled();
  });
});
