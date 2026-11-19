import { expect, test } from "./fixtures";

test("creates a project and opens the upload-analysis shell", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Projekt neve" }).fill("E2E projekt");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();

  await expect(page.getByRole("heading", { name: "E2E projekt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Képek hozzáadása" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Képarány és segédvonalak" })).toBeVisible();
  await expect(page.getByText("Készen áll")).toBeVisible();

  await page.getByLabel("Képarány-keret").selectOption("custom");
  await page.getByLabel("Tervezett szélesség (cm)").fill("30");
  await page.getByLabel("Tervezett magasság (cm)").fill("40");
  await expect(page.getByText("3 × 3 rács · oszlopköz: 10 cm · sorköz: 13,33 cm.")).toBeVisible();
  await page.getByLabel("Tervezett magasság (cm)").fill("24");
  await page.getByLabel("Segédvonal-rács").selectOption("custom");
  await page.getByLabel("Oszlopok száma").fill("10");
  await page.getByLabel("Sorok száma").fill("6");
  await page.getByLabel("Palettaszínek száma").selectOption("8");
  await page.getByLabel("Teljes tervezett festékmennyiség").fill("120");
  await page.getByLabel("Mennyiség egysége").selectOption("ml");
  await page.getByLabel("Gyártó").fill("Műhely");
  await page.getByLabel("Szín neve").fill("Kobaltkék");
  await expect(page.getByText(/oszlopköz: 3 cm/)).toBeVisible();
  await expect(page.getByText(/sorköz: 4 cm/)).toBeVisible();
  await expect(page.getByText("Minden projektbeállítás automatikusan elmentve.")).toBeVisible();
  await page.getByRole("button", { name: "Beállítások mentése" }).click();
  await expect(page.getByText("A kompozíciós beállítások elmentve a projektbe.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Képarány-keret")).toHaveValue("custom");
  await expect(page.getByLabel("Segédvonal-rács")).toHaveValue("custom");
  await expect(page.getByLabel("Oszlopok száma")).toHaveValue("10");
  await expect(page.getByLabel("Sorok száma")).toHaveValue("6");
  await expect(page.getByLabel("Palettaszínek száma")).toHaveValue("8");
  await expect(page.getByLabel("Teljes tervezett festékmennyiség")).toHaveValue("120");
  await expect(page.getByLabel("Mennyiség egysége")).toHaveValue("ml");
  await expect(page.getByLabel("Gyártó")).toHaveValue("Műhely");
  await expect(page.getByLabel("Szín neve")).toHaveValue("Kobaltkék");
  await expect(page.getByText(/oszlopköz: 3 cm/)).toBeVisible();
  await expect(page.getByText(/sorköz: 4 cm/)).toBeVisible();
});
