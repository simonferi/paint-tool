import type { CompositionPlan, PaletteExtraction } from "../../domain";
import { drawCompositionGuides } from "../composition/geometry";

const hatchColor = [22, 61, 50] as const;
const contourColor = [26, 39, 34] as const;

export function createPaletteMapPixels(
  palette: PaletteExtraction,
  colorNumber?: number,
  showContours = false,
): Uint8ClampedArray {
  const pixelCount = palette.width * palette.height;
  const output = new Uint8ClampedArray(pixelCount * 4);
  const targetIndex = colorNumber === undefined
    ? undefined
    : palette.colors.findIndex((color) => color.number === colorNumber);
  if (targetIndex !== undefined && targetIndex < 0) {
    throw new Error("A kiválasztott palettaszín nem található.");
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const x = pixel % palette.width;
    const y = Math.floor(pixel / palette.width);
    const offset = pixel * 4;
    const label = palette.labelMap[pixel];
    if (targetIndex === undefined) {
      const color = palette.colors[label];
      output[offset] = color.red;
      output[offset + 1] = color.green;
      output[offset + 2] = color.blue;
    } else {
      output[offset] = Math.round(palette.sourcePixels[offset] * 0.22 + 255 * 0.78);
      output[offset + 1] = Math.round(palette.sourcePixels[offset + 1] * 0.22 + 255 * 0.78);
      output[offset + 2] = Math.round(palette.sourcePixels[offset + 2] * 0.22 + 255 * 0.78);
      if (label === targetIndex && (x + y) % 8 < 2) {
        output[offset] = hatchColor[0];
        output[offset + 1] = hatchColor[1];
        output[offset + 2] = hatchColor[2];
      }
    }
    output[offset + 3] = 255;
  }

  if (showContours) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const label = palette.labelMap[pixel];
      const x = pixel % palette.width;
      const y = Math.floor(pixel / palette.width);
      const currentRelevant = targetIndex === undefined || label === targetIndex;
      let touchesBoundary = currentRelevant && (
        x === 0 || y === 0 || x === palette.width - 1 || y === palette.height - 1
      );
      const neighbors = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < palette.width ? pixel + 1 : -1,
        y > 0 ? pixel - palette.width : -1,
        y + 1 < palette.height ? pixel + palette.width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0) continue;
        const neighborLabel = palette.labelMap[neighbor];
        const isPaletteEdge = neighborLabel !== label;
        const touchesSelectedColor = targetIndex === undefined
          || label === targetIndex
          || neighborLabel === targetIndex;
        if (isPaletteEdge && touchesSelectedColor) {
          touchesBoundary = true;
          break;
        }
      }
      if (!touchesBoundary) continue;
      const offset = pixel * 4;
      output[offset] = contourColor[0];
      output[offset + 1] = contourColor[1];
      output[offset + 2] = contourColor[2];
      output[offset + 3] = 255;
    }
  }

  return output;
}

export function getPaletteMarkerPositions(palette: PaletteExtraction) {
  const separation = Math.max(palette.width, palette.height) * 0.045;
  const positions: Array<{ x: number; y: number; label: number }> = [];
  for (let colorIndex = 0; colorIndex < palette.colors.length; colorIndex += 1) {
    const marker = palette.colors[colorIndex].marker;
    let x = marker.x * Math.max(1, palette.width - 1);
    let y = marker.y * Math.max(1, palette.height - 1);
    const overlaps = (candidateX: number, candidateY: number) => positions.some((position) => (
      Math.hypot(candidateX - position.x, candidateY - position.y) < separation
    ));

    if (overlaps(x, y)) {
      let replacement: { x: number; y: number } | undefined;
      const step = Math.max(1, separation / 2);
      for (let distance = step; distance <= separation * 4 && !replacement; distance += step) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const candidateX = Math.max(0, Math.min(palette.width - 1, x + Math.cos(angle) * distance));
          const candidateY = Math.max(0, Math.min(palette.height - 1, y + Math.sin(angle) * distance));
          const pixel = Math.round(candidateY) * palette.width + Math.round(candidateX);
          if (palette.labelMap[pixel] === colorIndex && !overlaps(candidateX, candidateY)) {
            replacement = { x: candidateX, y: candidateY };
            break;
          }
        }
      }
      if (replacement) {
        x = replacement.x;
        y = replacement.y;
      }
    }
    positions.push({ x, y, label: colorIndex });
  }

  return positions.map(({ x, y }) => ({
    x: x / Math.max(1, palette.width - 1),
    y: y / Math.max(1, palette.height - 1),
  }));
}

export function drawPaletteMap(
  canvas: HTMLCanvasElement,
  palette: PaletteExtraction,
  composition: CompositionPlan,
  colorNumber?: number,
  showContours = false,
): void {
  canvas.width = palette.width;
  canvas.height = palette.height;
  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.createImageData(palette.width, palette.height);
  imageData.data.set(createPaletteMapPixels(palette, colorNumber, showContours));
  context.putImageData(imageData, 0, 0);
  drawCompositionGuides(
    context,
    { x: 0, y: 0, width: palette.width, height: palette.height },
    composition,
  );
  const fontSize = Math.max(9, Math.round(Math.min(palette.width, palette.height) * 0.045));
  if (colorNumber === undefined) {
    getPaletteMarkerPositions(palette).forEach((marker, index) => {
      drawNumberMarker(
        context,
        marker.x * Math.max(1, palette.width - 1),
        marker.y * Math.max(1, palette.height - 1),
        palette.colors[index].number,
        fontSize,
      );
    });
  } else {
    const radius = fontSize * 0.9;
    drawNumberMarker(
      context,
      Math.min(radius + 4, palette.width / 2),
      Math.min(radius + 4, palette.height / 2),
      colorNumber,
      fontSize,
    );
  }
}

export function renderPaletteMapBlob(
  palette: PaletteExtraction,
  composition: CompositionPlan,
  colorNumber?: number,
  showContours = false,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawPaletteMap(canvas, palette, composition, colorNumber, showContours);
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("A böngésző nem tudta PNG-ként elkészíteni a térképet."));
        }
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function drawNumberMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  number: number,
  fontSize: number,
): void {
  const radius = fontSize * 0.9;
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = "rgb(255 253 247 / 94%)";
  context.fill();
  context.lineWidth = Math.max(1.5, fontSize * 0.08);
  context.strokeStyle = "rgb(41 48 43 / 90%)";
  context.stroke();
  context.fillStyle = "#242a28";
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), x, y + 0.5);
  context.restore();
}
