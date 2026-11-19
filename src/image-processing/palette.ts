import type { AssetId, AssetRevision, PaletteExtraction, PaletteSize } from "../domain";
import { paletteExtractionSchema } from "../domain";

export const paletteVersion = 1 as const;
export const paletteMapMaxSide = 1000;

export type PaletteRgbaInput = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  assetId: AssetId;
  assetRevision: AssetRevision;
  requestedColors: PaletteSize;
};

type ColorPoint = {
  red: number;
  green: number;
  blue: number;
  weight: number;
};

type Centroid = {
  red: number;
  green: number;
  blue: number;
};

function colorDistance(red: number, green: number, blue: number, centroid: Centroid) {
  const redDifference = red - centroid.red;
  const greenDifference = green - centroid.green;
  const blueDifference = blue - centroid.blue;
  return redDifference * redDifference
    + greenDifference * greenDifference
    + blueDifference * blueDifference;
}

function nearestCentroid(red: number, green: number, blue: number, centroids: Centroid[]) {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < centroids.length; index += 1) {
    const distance = colorDistance(red, green, blue, centroids[index]);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function hexColor(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function compositeOverWhite(pixels: Uint8ClampedArray) {
  const opaquePixels = new Uint8ClampedArray(pixels.length);
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    opaquePixels[index] = Math.round(pixels[index] * alpha + 255 * (1 - alpha));
    opaquePixels[index + 1] = Math.round(pixels[index + 1] * alpha + 255 * (1 - alpha));
    opaquePixels[index + 2] = Math.round(pixels[index + 2] * alpha + 255 * (1 - alpha));
    opaquePixels[index + 3] = 255;
  }
  return opaquePixels;
}

function makeHistogram(sourcePixels: Uint8ClampedArray): ColorPoint[] {
  const counts = new Uint32Array(32 * 32 * 32);
  const redSums = new Float64Array(counts.length);
  const greenSums = new Float64Array(counts.length);
  const blueSums = new Float64Array(counts.length);

  for (let index = 0; index < sourcePixels.length; index += 4) {
    const red = sourcePixels[index];
    const green = sourcePixels[index + 1];
    const blue = sourcePixels[index + 2];
    const bin = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
    counts[bin] += 1;
    redSums[bin] += red;
    greenSums[bin] += green;
    blueSums[bin] += blue;
  }

  const points: ColorPoint[] = [];
  for (let bin = 0; bin < counts.length; bin += 1) {
    const weight = counts[bin];
    if (weight === 0) continue;
    points.push({
      red: redSums[bin] / weight,
      green: greenSums[bin] / weight,
      blue: blueSums[bin] / weight,
      weight,
    });
  }
  return points;
}

function initializeCentroids(points: ColorPoint[], count: number): Centroid[] {
  const first = points.reduce((largest, point) => point.weight > largest.weight ? point : largest);
  const centroids: Centroid[] = [{ red: first.red, green: first.green, blue: first.blue }];

  while (centroids.length < count) {
    let bestPoint: ColorPoint | undefined;
    let bestScore = -1;
    for (const point of points) {
      const nearestDistance = centroids.reduce(
        (distance, centroid) => Math.min(
          distance,
          colorDistance(point.red, point.green, point.blue, centroid),
        ),
        Number.POSITIVE_INFINITY,
      );
      const score = nearestDistance * point.weight;
      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }
    if (!bestPoint || bestScore <= 0) break;
    centroids.push({ red: bestPoint.red, green: bestPoint.green, blue: bestPoint.blue });
  }
  return centroids;
}

function refineCentroids(points: ColorPoint[], initial: Centroid[]): Centroid[] {
  let centroids = initial;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const redSums = new Float64Array(centroids.length);
    const greenSums = new Float64Array(centroids.length);
    const blueSums = new Float64Array(centroids.length);
    const counts = new Float64Array(centroids.length);

    for (const point of points) {
      const index = nearestCentroid(point.red, point.green, point.blue, centroids);
      redSums[index] += point.red * point.weight;
      greenSums[index] += point.green * point.weight;
      blueSums[index] += point.blue * point.weight;
      counts[index] += point.weight;
    }

    centroids = centroids
      .map((centroid, index) => counts[index] === 0
        ? centroid
        : {
          red: redSums[index] / counts[index],
          green: greenSums[index] / counts[index],
          blue: blueSums[index] / counts[index],
        })
      .filter((_, index) => counts[index] > 0);
  }
  return centroids;
}

export function extractPaletteRgba(input: PaletteRgbaInput): PaletteExtraction {
  const { pixels, width, height, assetId, assetRevision, requestedColors } = input;
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    throw new Error("A paletta készítéséhez érvényes RGBA képadat szükséges.");
  }
  if (width > paletteMapMaxSide || height > paletteMapMaxSide) {
    throw new Error("A palettatérkép legnagyobb oldala legfeljebb 1000 képpont lehet.");
  }

  const sourcePixels = compositeOverWhite(pixels);
  const histogram = makeHistogram(sourcePixels);
  const initialCentroids = initializeCentroids(
    histogram,
    Math.min(requestedColors, histogram.length),
  );
  const centroids = refineCentroids(histogram, initialCentroids);
  const labelMap = new Uint8Array(width * height);
  const clusterCounts = new Uint32Array(centroids.length);
  const redSums = new Float64Array(centroids.length);
  const greenSums = new Float64Array(centroids.length);
  const blueSums = new Float64Array(centroids.length);
  const xSums = new Float64Array(centroids.length);
  const ySums = new Float64Array(centroids.length);

  for (let pixel = 0; pixel < labelMap.length; pixel += 1) {
    const pixelOffset = pixel * 4;
    const red = sourcePixels[pixelOffset];
    const green = sourcePixels[pixelOffset + 1];
    const blue = sourcePixels[pixelOffset + 2];
    const cluster = nearestCentroid(red, green, blue, centroids);
    labelMap[pixel] = cluster;
    clusterCounts[cluster] += 1;
    redSums[cluster] += red;
    greenSums[cluster] += green;
    blueSums[cluster] += blue;
    xSums[cluster] += pixel % width;
    ySums[cluster] += Math.floor(pixel / width);
  }

  const clusterOrder = centroids
    .map((_, index) => index)
    .filter((index) => clusterCounts[index] > 0)
    .sort((left, right) => clusterCounts[right] - clusterCounts[left]
      || hexColor(
        Math.round(redSums[left] / clusterCounts[left]),
        Math.round(greenSums[left] / clusterCounts[left]),
        Math.round(blueSums[left] / clusterCounts[left]),
      ).localeCompare(hexColor(
        Math.round(redSums[right] / clusterCounts[right]),
        Math.round(greenSums[right] / clusterCounts[right]),
        Math.round(blueSums[right] / clusterCounts[right]),
      )));
  const remap = new Uint8Array(centroids.length);
  const colors = clusterOrder.map((cluster, index) => {
    remap[cluster] = index;
    const red = Math.round(redSums[cluster] / clusterCounts[cluster]);
    const green = Math.round(greenSums[cluster] / clusterCounts[cluster]);
    const blue = Math.round(blueSums[cluster] / clusterCounts[cluster]);
    return {
      number: index + 1,
      hex: hexColor(red, green, blue),
      red,
      green,
      blue,
      pixelCount: clusterCounts[cluster],
      marker: {
        x: xSums[cluster] / clusterCounts[cluster] / Math.max(1, width - 1),
        y: ySums[cluster] / clusterCounts[cluster] / Math.max(1, height - 1),
      },
    };
  });
  for (let pixel = 0; pixel < labelMap.length; pixel += 1) {
    labelMap[pixel] = remap[labelMap[pixel]];
  }

  return paletteExtractionSchema.parse({
    id: `palette:v${paletteVersion}:${assetId}:${assetRevision}:${requestedColors}`,
    assetId,
    assetRevision,
    paletteVersion,
    requestedColors,
    width,
    height,
    colors,
    labelMap,
    sourcePixels,
  });
}

export async function extractPaletteImageBlob(
  blob: Blob,
  input: Omit<PaletteRgbaInput, "pixels" | "width" | "height">,
  onProgress?: (
    stage: "decode" | "sample" | "quantize" | "map",
    completed: number,
    total: number,
  ) => void,
): Promise<PaletteExtraction> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    throw new Error("A böngésző nem támogatja a háttérben futó palettakészítést.");
  }

  onProgress?.("decode", 0, 1);
  const bitmap = await createImageBitmap(blob);
  try {
    onProgress?.("decode", 1, 1);
    const scale = Math.min(1, paletteMapMaxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("A palettakészítéshez nem érhető el háttérbeli 2D canvas.");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    onProgress?.("sample", 1, 1);
    onProgress?.("quantize", 0, 1);
    const result = extractPaletteRgba({
      ...input,
      pixels: imageData.data,
      width,
      height,
    });
    onProgress?.("quantize", 1, 1);
    onProgress?.("map", 1, 1);
    return result;
  } finally {
    bitmap.close();
  }
}
