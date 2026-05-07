import { test, expect, dismissJourneyStageOnboarding } from "./fixtures";

test.describe("state scale variant tabs (methodology v4)", () => {
  test("variant choice persists across reload", async ({ page }) => {
    // Register
    await page.goto("/register");
    await page.getByPlaceholder("Имя и фамилия").fill("Шкала Тест");
    await page.locator(".registration-option").first().click();
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page).toHaveURL(/\/participant\/session\/[^/]+\/today$/);

    // Onboarding modal traps pointer events.
    await dismissJourneyStageOnboarding(page);

    // Default tab — "Дуга" (arc-5)
    const tabsRow = page.locator(".participant-state-variant-tabs").first();
    await expect(tabsRow).toBeVisible();
    await expect(tabsRow.getByRole("tab", { name: "Дуга" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Switch to "Слайдер" (slider-5)
    await tabsRow.getByRole("tab", { name: "Слайдер" }).click();
    await expect(tabsRow.getByRole("tab", { name: "Слайдер" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Reload — выбор сохраняется.
    await page.reload();
    const tabsRowAfterReload = page.locator(".participant-state-variant-tabs").first();
    await expect(tabsRowAfterReload.getByRole("tab", { name: "Слайдер" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
