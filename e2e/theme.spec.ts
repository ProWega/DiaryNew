import { test, expect, dismissJourneyStageOnboarding } from "./fixtures";

test.describe("theme toggle", () => {
  test("default is light, toggling switches to dark and persists", async ({ page }) => {
    // Register first so the topbar (and theme toggle button) are rendered
    await page.goto("/register");
    await page.getByPlaceholder("Имя и фамилия").fill("Тёмный Тестировщик");
    await page.locator(".registration-option").first().click();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page).toHaveURL(/\/participant\/session\/[^/]+\/today$/);

    // Methodology v4 onboarding modal appears after registration — dismiss it.
    await dismissJourneyStageOnboarding(page);

    // Default theme — light
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Toggle to dark — the button's aria-label is "Переключить на тёмную тему"
    await page
      .getByRole("button", { name: /Переключить на тёмную тему/ })
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => window.localStorage.getItem("theme"))).toBe("dark");

    // Reload — FOUC-prevention script in index.html should keep dark on first paint
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Toggle back to light
    await page
      .getByRole("button", { name: /Переключить на светлую тему/ })
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => window.localStorage.getItem("theme"))).toBe("light");
  });
});
