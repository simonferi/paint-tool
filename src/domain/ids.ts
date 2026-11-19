export type Brand<T, Name extends string> = T & {
  readonly __brand: Name;
};

export type ProjectId = Brand<string, "ProjectId">;
export type AssetId = Brand<string, "AssetId">;
export type AnalysisId = Brand<string, "AnalysisId">;
export type AssetRevision = Brand<string, "AssetRevision">;

export function createId<T extends string>(): Brand<string, T> {
  return crypto.randomUUID() as Brand<string, T>;
}

export function createAssetRevision(input: {
  fileName: string;
  byteSize: number;
  lastModified: number;
}): AssetRevision {
  return `${input.fileName}:${input.byteSize}:${input.lastModified}` as AssetRevision;
}
