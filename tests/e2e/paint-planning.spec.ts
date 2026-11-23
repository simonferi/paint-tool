import { expect, test } from "./fixtures";

test("edits the local paint inventory, saves mixing notes, and estimates consumption", async ({ page }) => {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Projekt neve" }).fill("Festéktervezés");
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
    name: "festek-terv.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  });
  await expect(page.getByRole("heading", { name: "festek-terv.png" })).toBeVisible();
  await page.getByLabel("Palettaszínek száma").selectOption("4");
  await page.getByRole("button", { name: "Paletta készítése" }).click();
  await expect(page.getByText("A paletta elkészült: 4 szín.")).toBeVisible();

  await page.getByRole("textbox", { name: "Gyártó" }).fill("Műhely");
  await page.getByLabel("Szín neve").fill("Fekete");
  await page.getByLabel("Pigment- vagy termékkód").fill("PBk7");
  await page.getByLabel("Festék digitális színmintája").fill("#000000");
  await page.getByRole("button", { name: "Festék hozzáadása" }).click();
  await expect(page.getByText("A festék bekerült a helyi készletbe.")).toBeVisible();

  await page.getByRole("textbox", { name: "Gyártó" }).fill("Műhely");
  await page.getByLabel("Szín neve").fill("Fehér");
  await page.getByLabel("Pigment- vagy termékkód").fill("PW6");
  await page.getByLabel("Festék digitális színmintája").fill("#FFFFFF");
  await page.getByRole("button", { name: "Festék hozzáadása" }).click();
  await expect(page.locator("ul").getByText("Műhely · Fehér", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Szerkesztés: Fehér" }).click();
  await page.getByLabel("Adatforrás vagy mérési hivatkozás").fill("Test instrument reading");
  await page.getByLabel("Reflexiós értékek (380–780 nm, 10 nm-es lépés)")
    .fill(Array<string>(41).fill("0.5").join(", "));
  await page.getByLabel(
    "Megerősítem, hogy ezek egy optikailag vastag, homogén festékréteg diffúz reflexiós értékei.",
  ).check();
  await page.getByRole("button", { name: "Festék mentése" }).click();
  await expect(page.getByText("A festék adatai elmentve.")).toBeVisible();

  await page.getByLabel("Teljes tervezett festékmennyiség").fill("10");
  await page.getByLabel("Keverési modell").selectOption("kubelka-munk");
  await expect(page.getByText("CIEDE2000 ΔE00:")).toHaveCount(4);
  await expect(page.getByText(/Optikai adatok eredete:.*Test instrument reading/).first()).toBeVisible();
  await page.getByLabel("Mennyiség egysége").selectOption("ml");
  await expect(page.getByText(/A fizikai milliliteres bontáshoz minden receptbeli festék sűrűsége szükséges/).first()).toBeVisible();
  await page.getByLabel("Keverési modell").selectOption("rgb");
  await page.getByLabel("Mennyiség egysége").selectOption("g");

  const note = "Próbakeverés után szükség esetén kevés okkert adj hozzá.";
  await page.getByLabel("Keverési jegyzet a 1. színhez").fill(note);
  await expect(page.getByText("A keverési jegyzetek automatikusan mentve.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Mentett paletta betöltve: 4 szín.")).toBeVisible();
  await expect(page.getByLabel("Keverési jegyzet a 1. színhez")).toHaveValue(note);
  await page.getByRole("button", { name: "Jegyzet mentése: 1. szín" }).click();
  await expect(page.getByText("1. szín keverési jegyzete helyben elmentve.")).toBeVisible();

  await page.getByLabel("Teljes tervezett festékmennyiség").fill("0");
  await expect(page.getByText(/nullánál nagyobb teljes festékmennyiséget/).first()).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.getByLabel("Teljes tervezett festékmennyiség").fill("100");
  await expect(page.getByRole("table").nth(0).locator("tbody tr")).toHaveCount(4);
  await expect(page.getByRole("table").nth(1).locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("RGB-eltérés:")).toHaveCount(4);

  await page.getByRole("button", { name: "Szerkesztés: Fehér" }).click();
  await page.getByLabel("Szín neve").fill("Titánfehér");
  await page.getByRole("button", { name: "Festék mentése" }).click();
  await expect(page.locator("ul").getByText("Műhely · Titánfehér", { exact: true })).toBeVisible();

  await page.getByLabel("Mennyiség egysége").selectOption("ml");
  await expect(page.getByRole("table").nth(0).getByText(/ml$/).first()).toBeVisible();
  await page.reload();
  await expect(page.locator("ul").getByText("Műhely · Titánfehér", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Paletta készítése" }).click();
  await expect(page.getByText("A paletta elkészült: 4 szín.")).toBeVisible();
  await expect(page.getByLabel("Keverési jegyzet a 1. színhez")).toHaveValue(note);
  await expect(page.locator("ul").getByText("Műhely · Titánfehér", { exact: true })).toBeVisible();
});
