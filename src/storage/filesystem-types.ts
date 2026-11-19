export type WritableFile = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
};

export type FileHandleLike = {
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFile>;
};

export type DirectoryHandleLike = {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry?(name: string): Promise<void>;
  queryPermission?(options?: { mode?: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  requestPermission?(options?: { mode?: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
};

export function directoryPickerAvailable(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function pickDirectory(): Promise<DirectoryHandleLike | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    return null;
  }
  return picker({ mode: "readwrite" });
}

export async function ensureProjectFolders(root: DirectoryHandleLike) {
  const source = await root.getDirectoryHandle("source", { create: true });
  await source.getDirectoryHandle("reference", { create: true });
  await source.getDirectoryHandle("artwork", { create: true });
  const generated = await root.getDirectoryHandle("generated", { create: true });
  await generated.getDirectoryHandle("palettes", { create: true });
  await generated.getDirectoryHandle("exports", { create: true });
}

export async function getProjectAssetDirectory(
  root: DirectoryHandleLike,
  role: "reference" | "artwork",
) {
  const source = await root.getDirectoryHandle("source", { create: true });
  return source.getDirectoryHandle(role, { create: true });
}

export async function writePaletteFiles(
  root: DirectoryHandleLike,
  files: Array<{ name: string; blob: Blob }>,
): Promise<void> {
  const generated = await root.getDirectoryHandle("generated", { create: true });
  const palettes = await generated.getDirectoryHandle("palettes", { create: true });
  for (const file of files) {
    await writeFile(palettes, file.name, file.blob);
  }
}

export async function writeFile(
  directory: DirectoryHandleLike,
  fileName: string,
  blob: Blob,
) {
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}
