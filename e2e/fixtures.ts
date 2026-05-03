import { test as base, expect } from "@playwright/test";

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

export { expect };
