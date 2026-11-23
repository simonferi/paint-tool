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
  expect(schema.version).toBe(70);
  expect(schema.stores).toContain("paintColors");
  expect(schema.stores).toContain("paintMixNotes");
  expect(schema.stores).toContain("palettes");
  expect(schema.project.schemaVersion).toBe(5);
  expect(schema.project.composition).toMatchObject({
    crop: { mode: "crop", scale: 1, offsetX: 0, offsetY: 0 },
  });
  expect(schema.project.workspace).toEqual({
    palette: { sourceRole: "reference", requestedColors: 6, showContours: true },
    paint: {
      totalAmount: "",
      unit: "g",
      mixingModel: "rgb",
      draft: {
        manufacturer: "",
        name: "",
        pigmentCode: "",
        hex: "#808080",
        reflectanceSamples: "",
        spectralProvenance: "measured",
        spectralSource: "",
        infiniteLayerConfirmed: false,
        densityGPerMl: "",
      },
      editingPaintId: null,
    },
  });
});

test("migrates version 6 workspaces without dropping crop or paint data", async ({ page }) => {
  await page.route("**/src/main.tsx", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(async () => {
    const request = indexedDB.open("vonal-es-tonus", 60);
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
        const paints = db.createObjectStore("paintColors", { keyPath: "id" });
        paints.createIndex("projectId", "projectId");
        paints.createIndex("manufacturer", "manufacturer");
        paints.createIndex("name", "name");
        const notes = db.createObjectStore("paintMixNotes", { keyPath: "id" });
        notes.createIndex("projectId", "projectId");
        notes.createIndex("[projectId+targetHex]", ["projectId", "targetHex"]);
        const palettes = db.createObjectStore("palettes", { keyPath: "id" });
        palettes.createIndex("projectId", "projectId");
        palettes.createIndex("assetId", "assetId");
        palettes.createIndex("[projectId+savedAt]", ["projectId", "savedAt"]);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(["projects", "paintColors"], "readwrite");
      transaction.objectStore("projects").put({
        id: "v6-project",
        schemaVersion: 4,
        name: "Version 6 project",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        composition: {
          aspect: "free",
          widthCm: null,
          heightCm: null,
          grid: { mode: "thirds", columns: 10, rows: 6, cellCm: 4 },
        },
        workspace: {
          palette: { sourceRole: "reference", requestedColors: 6, showContours: true },
          paint: {
            totalAmount: "",
            unit: "g",
            mixingModel: "kubelka-munk",
            draft: {
              manufacturer: "Existing",
              name: "Spectral paint",
              pigmentCode: "PBr7",
              hex: "#78624A",
              reflectanceSamples: "0.31,0.34,0.38",
              spectralProvenance: "manufacturer",
              spectralSource: "catalog test fixture",
              infiniteLayerConfirmed: true,
              densityGPerMl: "1.4",
            },
            editingPaintId: null,
          },
        },
        storage: { mode: "indexeddb" },
      });
      transaction.objectStore("projects").put({
        id: "v6-crop-project",
        schemaVersion: 4,
        name: "Version 6 crop project",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        composition: {
          aspect: "4:3",
          widthCm: 30,
          heightCm: 40,
          crop: { mode: "canvas", scale: 1.5, offsetX: 0.25, offsetY: -0.1 },
          grid: { mode: "thirds", columns: 10, rows: 6, cellCm: 4 },
        },
        workspace: {
          palette: { sourceRole: "reference", requestedColors: 6, showContours: true },
          paint: {
            totalAmount: "",
            unit: "g",
            draft: { manufacturer: "", name: "", pigmentCode: "", hex: "#808080" },
            editingPaintId: null,
          },
        },
        storage: { mode: "indexeddb" },
      });
      transaction.objectStore("paintColors").put({
        id: "legacy-paint",
        schemaVersion: 1,
        projectId: "v6-project",
        manufacturer: "Legacy",
        name: "HEX only",
        pigmentCode: "",
        hex: "#808080",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.unroute("**/src/main.tsx");
  await page.reload();
  const migrated = await page.evaluate(async () => {
    const request = indexedDB.open("vonal-es-tonus");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<{
      project: Record<string, unknown>;
      cropProject: Record<string, unknown>;
      paint: Record<string, unknown>;
    }>((resolve, reject) => {
      const transaction = database.transaction(["projects", "paintColors"], "readonly");
      const projectRead = transaction.objectStore("projects").get("v6-project");
      const cropProjectRead = transaction.objectStore("projects").get("v6-crop-project");
      const paintRead = transaction.objectStore("paintColors").get("legacy-paint");
      const result: Partial<{
        project: Record<string, unknown>;
        cropProject: Record<string, unknown>;
        paint: Record<string, unknown>;
      }> = {};
      const finish = () => {
        if (result.project && result.cropProject && result.paint) {
          resolve(result as {
            project: Record<string, unknown>;
            cropProject: Record<string, unknown>;
            paint: Record<string, unknown>;
          });
        }
      };
      projectRead.onsuccess = () => {
        result.project = projectRead.result;
        finish();
      };
      cropProjectRead.onsuccess = () => {
        result.cropProject = cropProjectRead.result;
        finish();
      };
      paintRead.onsuccess = () => {
        result.paint = paintRead.result;
        finish();
      };
      projectRead.onerror = () => reject(projectRead.error);
      cropProjectRead.onerror = () => reject(cropProjectRead.error);
      paintRead.onerror = () => reject(paintRead.error);
    });
    const output = { version: database.version, ...records };
    database.close();
    return output;
  });

  expect(migrated.version).toBe(70);
  expect(migrated.project.schemaVersion).toBe(5);
  expect(migrated.project.composition).toMatchObject({
    crop: { mode: "crop", scale: 1, offsetX: 0, offsetY: 0 },
  });
  expect(migrated.project.workspace).toMatchObject({
    paint: {
      mixingModel: "kubelka-munk",
      draft: {
        reflectanceSamples: "0.31,0.34,0.38",
        spectralProvenance: "manufacturer",
        spectralSource: "catalog test fixture",
        infiniteLayerConfirmed: true,
        densityGPerMl: "1.4",
      },
    },
  });
  expect(migrated.cropProject).toMatchObject({
    schemaVersion: 5,
    composition: {
      crop: { mode: "canvas", scale: 1.5, offsetX: 0.25, offsetY: -0.1 },
    },
    workspace: { paint: { mixingModel: "rgb" } },
  });
  expect(migrated.paint.schemaVersion).toBe(2);
  expect(migrated.paint.opticalData).toBeUndefined();
  expect(migrated.paint.densityGPerMl).toBeUndefined();
});
