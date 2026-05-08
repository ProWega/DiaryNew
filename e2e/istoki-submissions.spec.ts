import { test, expect } from "@playwright/test";

test.describe("Истоки · Заявки и модерация", () => {
  test("публичный посетитель отправляет заявку и видит её статус", async ({ page }) => {
    await page.goto("/istoki/map");

    // Hero CTA opens the submission modal pre-seeded with Moscow
    await page.getByRole("button", { name: /Поделиться своей историей/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Step 1 — pick "Личная история"
    await dialog.getByRole("button", { name: /Личная история/ }).click();
    await dialog.getByRole("button", { name: /Продолжить/ }).click();

    // Step 2 — story fields
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Имя участника" })
      .locator("input")
      .fill("Анна Тестова");
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Возраст" })
      .locator("input")
      .fill("28, преподаватель");
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Что было до" })
      .locator("textarea")
      .fill("Раньше я думала, что заезды — это для других.");
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Что стало после" })
      .locator("textarea")
      .fill("Поняла, что мой опыт тоже важен.");
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Цитата-манифест" })
      .locator("textarea")
      .fill("Я нашла свой голос.");
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Ссылка на фото" })
      .locator("input")
      .fill("https://example.com/photo.jpg");

    await dialog.getByRole("button", { name: /К контактам/ }).click();

    // Step 3 — contact fields
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Ваше имя" })
      .locator("input")
      .fill("Анна Тестова");
    await dialog
      .locator(".istoki-submit-field")
      .filter({ hasText: "Email" })
      .locator("input")
      .fill("anna@example.com");
    await dialog.locator(".istoki-submit-consent input").check();

    await dialog.getByRole("button", { name: /Отправить заявку/ }).click();

    // Success screen
    await expect(dialog.getByText(/Заявка #/)).toBeVisible();
    const code = dialog.locator(".istoki-submit-status-url code");
    await expect(code).toBeVisible();
    const statusUrlText = await code.innerText();
    expect(statusUrlText).toContain("/istoki/submission/");
  });

  test("дип-линк на /istoki/submission/:token открывает страницу статуса", async ({ page }) => {
    // Submit through MSW (page-side fetch) so the in-memory store sees the
    // submission, then navigate to the status URL.
    await page.goto("/istoki/map");
    // Wait for MSW to be active before issuing fetches — its handlers
    // run in the page context and need the bundle + worker to be live.
    await page.waitForSelector('[data-region-code="pskov"]');
    const body = await page.evaluate(async () => {
      const res = await fetch("/api/public/istoki/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "chronicle",
          regionCode: "pskov",
          submitterName: "Тестер",
          submitterEmail: "tester@example.com",
          draft: {
            eventDate: "2025-09-01",
            eventTitle: "Тестовое событие",
            participantsCount: 10,
            keyInsights: ["Инсайт"],
          },
        }),
      });
      return res.json();
    });
    expect(body.statusToken).toBeTruthy();

    // Navigate within the SPA to keep the MSW handlers' in-memory store
    // alive — page.goto would reload the bundle and wipe the submission.
    await page.evaluate((token) => {
      window.history.pushState({}, "", `/istoki/submission/${token}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, body.statusToken);

    await expect(page.getByText(/На модерации/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Событие летописи/ })).toBeVisible();
  });
});
