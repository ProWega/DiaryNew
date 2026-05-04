import { test, expect } from "@playwright/test";

test.describe("Истоки · Admin CMS", () => {
  test("неавторизованный пользователь не попадает на /admin/istoki", async ({ page }) => {
    await page.goto("/admin/istoki");
    // Without auth the AppLayout parent route redirects to /register.
    await expect(page).toHaveURL(/\/register$/);
  });
});
