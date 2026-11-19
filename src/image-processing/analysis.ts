import type { ImageAnalysis } from "../domain";
import type { AssetId, AssetRevision } from "../domain";

export const imageAnalysisVersion = 1 as const;

export type RgbaAnalysisInput = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  assetId: AssetId;
  assetRevision: AssetRevision;
  now?: Date;
};

export function analyzeRgba(input: RgbaAnalysisInput): ImageAnalysis {
  const { pixels, width, height } = input;
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    throw new Error("Az elemzéshez érvényes RGBA képadat szükséges.");
  }

  const bins = [0, 0, 0, 0, 0] as [number, number, number, number, number];
  let luminanceSum = 0;
  const sampleCount = width * height;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    const red = pixels[index] * alpha + 255 * (1 - alpha);
    const green = pixels[index + 1] * alpha + 255 * (1 - alpha);
    const blue = pixels[index + 2] * alpha + 255 * (1 - alpha);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceSum += luminance;
    bins[Math.min(4, Math.floor(luminance / 51))] += 1;
  }

  return {
    id: `image-analysis:v1:${input.assetId}:${input.assetRevision}`,
    assetId: input.assetId,
    assetRevision: input.assetRevision,
    analysisVersion: imageAnalysisVersion,
    width,
    height,
    aspectRatio: width / height,
    tone: {
      mean: luminanceSum / sampleCount,
      bins,
      sampleCount,
    },
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

export async function analyzeImageBlob(
  blob: Blob,
  input: Omit<RgbaAnalysisInput, "pixels" | "width" | "height" | "now">,
  sampleMaxSide: number,
  onProgress?: (stage: "decode" | "sample" | "analyze", completed: number, total: number) => void,
): Promise<ImageAnalysis> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    throw new Error("A böngésző nem támogatja a háttérben futó képelemzést.");
  }

  onProgress?.("decode", 0, 1);
  const bitmap = await createImageBitmap(blob);
  try {
    onProgress?.("decode", 1, 1);
    const scale = Math.min(1, sampleMaxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("A háttérben futó képelemzéshez nem érhető el 2D canvas.");
    }

    context.drawImage(bitmap, 0, 0, width, height);
    onProgress?.("sample", 1, 1);
    const imageData = context.getImageData(0, 0, width, height);
    onProgress?.("analyze", 0, 1);
    const result = analyzeRgba({
      ...input,
      pixels: imageData.data,
      width,
      height,
    });
    onProgress?.("analyze", 1, 1);
    return {
      ...result,
      width: bitmap.width,
      height: bitmap.height,
      aspectRatio: bitmap.width / bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
