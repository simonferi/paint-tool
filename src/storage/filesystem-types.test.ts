import { describe, expect, it } from "vitest";
import type { DirectoryHandleLike, FileHandleLike, WritableFile } from "./filesystem-types";
import { writePaletteFiles } from "./filesystem-types";

function createMemoryDirectory(
  path: string,
  files: Map<string, Blob>,
  directories: Set<string>,
): DirectoryHandleLike {
  return {
    name: path.split("\\").at(-1) ?? path,
    async getDirectoryHandle(name) {
      const childPath = `${path}\\${name}`;
      directories.add(childPath);
      return createMemoryDirectory(childPath, files, directories);
    },
    async getFileHandle(name): Promise<FileHandleLike> {
      const filePath = `${path}\\${name}`;
      return {
        async getFile() {
          const blob = files.get(filePath);
          if (!blob) throw new Error("File not found.");
          return new File([blob], name);
        },
        async createWritable(): Promise<WritableFile> {
          let output: Blob | undefined;
          return {
            async write(blob) {
              output = blob;
            },
            async close() {
              if (!output) throw new Error("No content written.");
              files.set(filePath, output);
            },
          };
        },
      };
    },
  };
}

describe("generated palette file storage", () => {
  it("writes all PNGs under generated/palettes", async () => {
    const files = new Map<string, Blob>();
    const directories = new Set<string>();
    const root = createMemoryDirectory("project", files, directories);
    const numbered = new Blob(["numbered"], { type: "image/png" });
    const region = new Blob(["region"], { type: "image/png" });

    await writePaletteFiles(root, [
      { name: "reference-szamozott-szinpaletta-04.png", blob: numbered },
      { name: "reference-palettaszin-01-FF0000-04.png", blob: region },
    ]);

    expect(directories).toEqual(new Set(["project\\generated", "project\\generated\\palettes"]));
    expect(files.get("project\\generated\\palettes\\reference-szamozott-szinpaletta-04.png")).toBe(numbered);
    expect(files.get("project\\generated\\palettes\\reference-palettaszin-01-FF0000-04.png")).toBe(region);
  });
});
