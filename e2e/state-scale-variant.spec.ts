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

    // Variant tabs are wrapped in <details> "Вид шкалы" — open it first.
    const variantToggle = page.locator(".participant-state-variant-toggle").first();
    await variantToggle.locator("summary").click();

    const tabsRow = variantToggle.locator(".participant-state-variant-tabs");
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

    // Reload — выбор сохраняется. Открываем details снова, чтобы прочесть aria-selected.
    await page.reload();
    const variantToggleAfterReload = page.locator(".participant-state-variant-toggle").first();
    await variantToggleAfterReload.locator("summary").click();
    const tabsRowAfterReload = variantToggleAfterReload.locator(".participant-state-variant-tabs");
    await expect(tabsRowAfterReload.getByRole("tab", { name: "Слайдер" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
