import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("paint-tool-language", "hu");
    });
    await use(page);
  },
});

export { expect };
