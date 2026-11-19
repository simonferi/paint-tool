import { expect, test } from "@playwright/test";

test("defaults to English and remembers a selected language", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("test-language-started")) {
      localStorage.removeItem("paint-tool-language");
      sessionStorage.setItem("test-language-started", "true");
      Object.defineProperty(navigator, "language", {
        configurable: true,
        value: "hu-HU",
      });
    }
  });
  await page.goto("/");

  await expect(page.locator("#language-select")).toHaveValue("en");
  await expect(page.getByRole("heading", { name: "Line & Tone" })).toBeVisible();
  await expect(page.getByText("Local projects, composition guides and numbered palette maps.")).toBeVisible();

  await page.locator("#language-select").selectOption("cs");
  await expect(page.getByLabel("Jazyk")).toHaveValue("cs");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("paint-tool-language"))).toBe("cs");
  await expect(page.getByText("Projekty", { exact: true })).toBeVisible();
  await page.getByLabel("Název projektu").fill("Test lokalizace");
  await page.getByRole("button", { name: "Vytvořit projekt" }).click();
  await expect(page.getByRole("heading", { name: "Přidat obrázky" })).toBeVisible();

  await page.reload();
  await expect(page.locator("#language-select")).toHaveValue("cs");
  await expect(page.getByRole("heading", { name: "Přidat obrázky" })).toBeVisible();
});
