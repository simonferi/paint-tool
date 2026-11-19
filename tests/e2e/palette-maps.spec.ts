import { expect, test } from "./fixtures";
import { readFile } from "node:fs/promises";

test("extracts a local palette, shows maps, and downloads labeled PNGs", async ({ page }, testInfo) => {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Paletta térkép");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();

  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in the test browser.");
    context.fillStyle = "#ec1c24";
    context.fillRect(0, 0, 8, 8);
    context.fillStyle = "#1828ed";
    context.fillRect(8, 0, 8, 8);
    context.fillStyle = "#1cbd35";
    context.fillRect(0, 8, 8, 8);
    context.fillStyle = "#ead629";
    context.fillRect(8, 8, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "szintabla.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });

  await expect(page.getByRole("heading", { name: "szintabla.png" })).toBeVisible();
  await page.getByLabel("Palettaszínek száma").selectOption("4");
  await page.getByRole("button", { name: "Paletta készítése" }).click();

  await expect(page.getByText("A paletta elkészült: 4 szín.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Színenkénti területtérképek" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Számozott palettatérkép/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /szín területtérképe/ })).toHaveCount(4);
  await expect(page.getByRole("list").getByText(/1 · #[0-9A-F]{6}/)).toBeVisible();

  await page.getByLabel("Kontúrok megjelenítése").uncheck();
  await expect(page.getByRole("img", { name: /Számozott palettatérkép/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Minden projektbeállítás automatikusan elmentve." }))
    .toBeVisible();
  await page.reload();
  await expect(page.getByText("Mentett paletta betöltve: 4 szín.")).toBeVisible();
  await expect(page.getByLabel("Kontúrok megjelenítése")).not.toBeChecked();

  const numberedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Számozott palettatérkép letöltése PNG-fájlként" }).click();
  const numberedDownload = await numberedDownloadPromise;
  expect(numberedDownload.suggestedFilename()).toBe("szamozott-szinpaletta.png");
  const numberedPath = testInfo.outputPath(numberedDownload.suggestedFilename());
  await numberedDownload.saveAs(numberedPath);
  const numberedPng = await readFile(numberedPath);
  expect(numberedPng.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(numberedPng.readUInt32BE(16)).toBe(16);
  expect(numberedPng.readUInt32BE(20)).toBe(16);

  const regionDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "1. szín területtérképének letöltése PNG-fájlként" }).click();
  const regionDownload = await regionDownloadPromise;
  expect(regionDownload.suggestedFilename()).toMatch(/^palettaszin-01-[0-9A-F]{6}\.png$/);
  const regionPath = testInfo.outputPath(regionDownload.suggestedFilename());
  await regionDownload.saveAs(regionPath);
  const regionPng = await readFile(regionPath);
  expect(regionPng.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(regionPng.readUInt32BE(16)).toBe(16);
  expect(regionPng.readUInt32BE(20)).toBe(16);

  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Másik projekt");
  await page.getByRole("button", { name: "Projekt létrehozása" }).click();
  await expect(page.getByRole("heading", { name: "Másik projekt" })).toBeVisible();
  await page.getByRole("button", { name: /Paletta térkép/ }).click();
  await expect(page.getByText("Mentett paletta betöltve: 4 szín.")).toBeVisible();
  await expect(page.getByRole("img", { name: /Számozott palettatérkép/ })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Paletta térkép/ }).click();
  await expect(page.getByText("Mentett paletta betöltve: 4 szín.")).toBeVisible();
  await expect(page.getByRole("img", { name: /Számozott palettatérkép/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /szín területtérképe/ })).toHaveCount(4);

  await page.evaluate(async () => {
    const request = indexedDB.open("vonal-es-tonus");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("fallbackBlobs", "readwrite");
      transaction.objectStore("fallbackBlobs").clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.getByRole("button", { name: "Paletta készítése" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "A kiválasztott kép nem érhető el a helyi projektmappában vagy tárban.",
  );
});
