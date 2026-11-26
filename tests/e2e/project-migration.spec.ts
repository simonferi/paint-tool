import { expect, test } from "./fixtures";

test("migrates an existing project and installs paint-planning stores", async ({ page }) => {
  await page.route("**/src/main.tsx", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(async () => {
    const request = indexedDB.open("vonal-es-tonus", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const db = request.result;
        const projects = db.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("updatedAt", "updatedAt");
        const assets = db.createObjectStore("assets", { keyPath: "id" });
        assets.createIndex("projectId", "projectId");
        assets.createIndex("[projectId+role]", ["projectId", "role"]);
        const analyses = db.createObjectStore("analyses", { keyPath: "id" });
        analyses.createIndex("assetId", "assetId");
        analyses.createIndex(
          "[assetId+assetRevision+analysisVersion]",
          ["assetId", "assetRevision", "analysisVersion"],
        );
        const fallbackBlobs = db.createObjectStore("fallbackBlobs", { keyPath: "assetId" });
        fallbackBlobs.createIndex("assetId", "assetId");
        const bindings = db.createObjectStore("storageBindings", { keyPath: "projectId" });
        bindings.createIndex("rootKey", "rootKey");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("projects", "readwrite");
      transaction.objectStore("projects").put({
        id: "legacy-project",
        schemaVersion: 1,
        name: "Korábbi projekt",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        storage: { mode: "indexeddb" },
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.unroute("**/src/main.tsx");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Korábbi projekt" })).toBeVisible();
  await expect(page.getByLabel("Képarány-keret")).toHaveValue("free");
  await expect(page.getByLabel("Segédvonal-rács")).toHaveValue("thirds");
  const schema = await page.evaluate(async () => {
    const request = indexedDB.open("vonal-es-tonus");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const project = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const transaction = database.transaction("projects", "readonly");
      const read = transaction.objectStore("projects").get("legacy-project");
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    const result = {
      version: database.version,
      stores: Array.from(database.objectStoreNames),
      project,
    };
    database.close();
    return result;
  });
  expect(schema.version).toBe(60);
  expect(schema.stores).toContain("paintColors");
  expect(schema.stores).toContain("paintMixNotes");
  expect(schema.stores).toContain("palettes");
  expect(schema.project.schemaVersion).toBe(4);
  expect(schema.project.workspace).toEqual({
    palette: { sourceRole: "reference", requestedColors: 6, showContours: true },
    paint: {
      totalAmount: "",
      unit: "g",
      draft: { manufacturer: "", name: "", pigmentCode: "", hex: "#808080" },
      editingPaintId: null,
    },
  });
});
