import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function readFallbackBlobSizes(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("vonal-es-tonus");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<Array<{ blob: Blob }>>((resolve, reject) => {
      const transaction = db.transaction("fallbackBlobs", "readonly");
      const request = transaction.objectStore("fallbackBlobs").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return values.map(({ blob }) => blob.size);
  });
}

test("stores a consented image analysis and restores it after reload", async ({ page }) => {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Elemzési projekt");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();

  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in the test browser.");
    context.fillStyle = "#808080";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  });

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });

  await expect(page.getByText("A kép az IndexedDB helyi tárolójába került. A projektmappa nem lett használva.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "reference.png" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Referencia képének előnézete" })).toBeVisible();
  await expect(page.getByText("4 × 2 px · Képarány: 2:1 (2,00)")).toBeVisible();
  await expect(page.getByLabel("Referencia kompozíciós előnézete")).toBeVisible();
  await expect(page.getByText("Átlagos tónus: 50 / 100")).toBeVisible();
  await expect(page.getByText("Tónuseloszlás sötéttől világosig: 0 · 0 · 8 · 0 · 0")).toBeVisible();

  const replacementBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 3;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in the test browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from(replacementBase64, "base64"),
  });
  await expect(page.getByRole("heading", { name: "replacement.png" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Referencia képének előnézete" })).toBeVisible();
  await expect(page.getByText("3 × 2 px · Képarány: 3:2 (1,50)")).toBeVisible();
  await expect(page.getByLabel("Referencia kompozíciós előnézete")).toBeVisible();
  await expect(page.getByRole("heading", { name: "reference.png" })).toHaveCount(0);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByText("Átlagos tónus: 100 / 100")).toBeVisible();
  await expect.poll(() => readFallbackBlobSizes(page)).toEqual([Buffer.byteLength(replacementBase64, "base64")]);

  await page.reload();

  await expect(page.getByRole("heading", { name: "Elemzési projekt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "replacement.png" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Referencia képének előnézete" })).toBeVisible();
  await expect(page.getByText("3 × 2 px · Képarány: 3:2 (1,50)")).toBeVisible();
  await expect(page.getByLabel("Referencia kompozíciós előnézete")).toBeVisible();
  await expect(page.getByRole("heading", { name: "reference.png" })).toHaveCount(0);
  await expect(page.getByText("Átlagos tónus: 100 / 100")).toBeVisible();
  await expect(page.getByText("Tónuseloszlás sötéttől világosig: 0 · 0 · 0 · 0 · 6")).toBeVisible();
  await expect.poll(() => readFallbackBlobSizes(page)).toEqual([Buffer.byteLength(replacementBase64, "base64")]);

  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Másik projekt");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();
  await expect(page.getByRole("heading", { name: "Másik projekt" })).toBeVisible();
  await page.getByRole("button", { name: /Elemzési projekt/ }).click();
  await expect(page.getByRole("img", { name: "Referencia képének előnézete" })).toBeVisible();
  await expect(page.getByText("3 × 2 px · Képarány: 3:2 (1,50)")).toBeVisible();
});

test("does not save a file when local fallback consent is declined", async ({ page }) => {
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Engedélyezés nélkül");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();

  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in the test browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 1, 1);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "private.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });

  await expect(page.getByText("A képet nem mentettük el, mert a helyi IndexedDB-tároláshoz nem adtál engedélyt.")).toBeVisible();
  await expect(page.getByText("Elemzés még nem érhető el.")).toHaveCount(0);
  await expect(page.getByText("A feltöltött képek itt jelennek meg az első elemzés után.")).toBeVisible();
});

test("shows the full portrait image in a ratio-preserving thumbnail", async ({ page }) => {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Álló miniatúra");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();

  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in the test browser.");
    context.fillStyle = "#3498db";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });

  const thumbnail = page.getByRole("img", { name: "Referencia képének előnézete" });
  await expect(thumbnail).toBeVisible();
  await expect(page.getByText("300 × 600 px · Képarány: 1:2 (0,50)")).toBeVisible();
  await expect(thumbnail).toHaveCSS("object-fit", "contain");
  await expect(page.getByRole("heading", { name: "portrait.png" })).toBeVisible();
  await expect.poll(async () => {
    const bounds = await thumbnail.boundingBox();
    return bounds ? bounds.width / bounds.height : null;
  }).toBeCloseTo(0.5, 1);
});
