import { test as base, expect, type Page } from "@playwright/test";

/**
 * Custom fixture: each test starts with a clean localStorage so MSW seed and
 * auth state are deterministic. After the page navigates we wait for the MSW
 * service worker to be ready before letting the test continue.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Visit the origin once so we can clear its localStorage before any app code runs.
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
    });

    // The MSW worker registers on load. Wait for it before any test.
    await page.waitForFunction(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg && reg.active);
    });

    await use(page);
  },
});

/**
 * После регистрации участника появляется JourneyStageOnboardingModal
 * (methodology v4 onboarding). Тесты, которые проверяют что-то вне модала
 * (theme, navigation, etc), должны его закрыть через «Решу позже».
 *
 * Robust к задержке монтирования модала: ждёт появления до 8s, кликает,
 * ждёт исчезновения backdrop'а, чтобы pointer events не были перехвачены.
 */
export async function dismissJourneyStageOnboarding(page: Page) {
  const backdrop = page.locator(".modal-backdrop");
  try {
    await backdrop.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    return; // Модал не появился — нечего скрывать.
  }

  const skip = page.getByRole("button", { name: "Решу позже" });
  await skip.click();
  // Wait for backdrop to fully detach so subsequent clicks aren't intercepted.
  await backdrop.waitFor({ state: "detached", timeout: 5000 });
}

export { expect };
