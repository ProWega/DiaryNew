import { test, expect } from "@playwright/test";

test.describe("Истоки · Голоса регионов", () => {
  test("публичная карта открывает портал региона", async ({ page }) => {
    await page.goto("/istoki/map");

    await expect(page).toHaveURL(/\/istoki\/map$/);
    await expect(page.locator(".istoki-shell")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Карта");

    await page.locator('[data-region-code="sevastopol"]').click();

    await expect(page).toHaveURL(/region=sevastopol/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Севастополь");

    await expect(page.getByRole("tab", { name: "Голос региона" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Личные истории" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Цифровая летопись" })).toBeVisible();
  });

  test("дип-линк /istoki/region/:code открывает drawer", async ({ page }) => {
    await page.goto("/istoki/region/pskov");

    await expect(page).toHaveURL(/\/istoki\/map\?region=pskov/);
    await expect(page.getByRole("dialog")).toContainText("Псков");
  });

  test("затемнённые регионы не открывают портал", async ({ page }) => {
    await page.goto("/istoki/map");
    const empty = page.locator('[data-region-code="vladivostok"]');
    await expect(empty).toHaveAttribute("data-empty", "true");
    await empty.click({ force: true });
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
