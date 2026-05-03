import { test, expect } from "./fixtures";

test.describe("registration → diary", () => {
  test("a new participant lands on the diary page after registration", async ({ page }) => {
    await page.goto("/register");

    await page.getByPlaceholder("Имя и фамилия").fill("Тест Иванов");
    await page.locator(".registration-option").first().click();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();

    // Redirected to /participant/session/<id>/today
    await expect(page).toHaveURL(/\/participant\/session\/[^/]+\/today$/);

    // Diary view shows the state scale
    await expect(page.getByText("Шкала состояния").first()).toBeVisible();

    // Auth user persisted in localStorage by AuthContext
    const storedAuthUser = await page.evaluate(() =>
      window.localStorage.getItem("newdiary-auth-user"),
    );
    expect(storedAuthUser).toBeTruthy();
    expect(storedAuthUser).toMatch(/user-participant-/);
  });

  test("registered user persists across reload", async ({ page }) => {
    await page.goto("/register");
    await page.getByPlaceholder("Имя и фамилия").fill("Тест Сохранения");
    await page.locator(".registration-option").first().click();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page).toHaveURL(/\/participant\/session\/[^/]+\/today$/);

    await page.reload();
    // Still on the diary page after reload — no bounce back to /register
    await expect(page).toHaveURL(/\/participant\/session\/[^/]+\/today$/);
  });
});
