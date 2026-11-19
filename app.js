"use strict";

const pigments = [
  { id: "titanium-white", name: "Titánfehér", hex: "#f2eee0" },
  { id: "yellow-ochre", name: "Sárga okker", hex: "#b88a3e" },
  { id: "cadmium-yellow", name: "Kadmiumsárga (utánzat)", hex: "#e5bd32" },
  { id: "vermilion", name: "Vermilion (utánzat)", hex: "#c94e36" },
  { id: "alizarin-crimson", name: "Alizarin kármin (utánzat)", hex: "#842d42" },
  { id: "ultramarine", name: "Ultramarinkék", hex: "#354b9b" },
  { id: "phthalo-blue", name: "Ftalókék (utánzat)", hex: "#176b7e" },
  { id: "burnt-sienna", name: "Égetett szienna", hex: "#9b5337" },
  { id: "burnt-umber", name: "Égetett umbra", hex: "#554037" },
  { id: "ivory-black", name: "Elefántcsontfekete", hex: "#292a29" },
];

const starterRecipes = [
  { label: "Földes zöld", pigmentA: "yellow-ochre", pigmentB: "ultramarine", partsA: 1, partsB: 1 },
  { label: "Meleg narancs", pigmentA: "cadmium-yellow", pigmentB: "vermilion", partsA: 2, partsB: 1 },
  { label: "Ibolya", pigmentA: "ultramarine", pigmentB: "alizarin-crimson", partsA: 2, partsB: 1 },
  { label: "Semleges sötét", pigmentA: "ultramarine", pigmentB: "burnt-umber", partsA: 1, partsB: 1 },
];

const toneBinNames = ["sötét", "mély", "közép", "világos", "fény"];
const state = {
  reference: null,
  artwork: null,
  savedRecipes: [],
  paintInventory: [],
  paletteMap: null,
  paletteRenderId: 0,
  downloadUrls: [],
  selectedSwatch: null,
};

const elements = {
  referenceInput: document.querySelector("#referenceInput"),
  artworkInput: document.querySelector("#artworkInput"),
  referenceCanvas: document.querySelector("#referenceCanvas"),
  artworkCanvas: document.querySelector("#artworkCanvas"),
  referenceFileStatus: document.querySelector("#referenceFileStatus"),
  artworkFileStatus: document.querySelector("#artworkFileStatus"),
  referenceCanvasHint: document.querySelector("#referenceCanvasHint"),
  artworkCanvasHint: document.querySelector("#artworkCanvasHint"),
  referenceRatio: document.querySelector("#referenceRatio"),
  artworkRatio: document.querySelector("#artworkRatio"),
  uploadError: document.querySelector("#uploadError"),
  ratioSelect: document.querySelector("#ratioSelect"),
  gridSelect: document.querySelector("#gridSelect"),
  plannedWidthCm: document.querySelector("#plannedWidthCm"),
  plannedHeightCm: document.querySelector("#plannedHeightCm"),
  customGridSettings: document.querySelector("#customGridSettings"),
  gridColumns: document.querySelector("#gridColumns"),
  gridRows: document.querySelector("#gridRows"),
  metricGridSettings: document.querySelector("#metricGridSettings"),
  gridCellCm: document.querySelector("#gridCellCm"),
  gridSpacingSummary: document.querySelector("#gridSpacingSummary"),
  aspectSummary: document.querySelector("#aspectSummary"),
  toneComparison: document.querySelector("#toneComparison"),
  paletteSource: document.querySelector("#paletteSource"),
  paletteCount: document.querySelector("#paletteCount"),
  extractPaletteButton: document.querySelector("#extractPaletteButton"),
  paletteMapCanvas: document.querySelector("#paletteMapCanvas"),
  paletteMapStatus: document.querySelector("#paletteMapStatus"),
  downloadPaletteMap: document.querySelector("#downloadPaletteMap"),
  contourToggle: document.querySelector("#contourToggle"),
  paletteRegionMaps: document.querySelector("#paletteRegionMaps"),
  paletteSwatches: document.querySelector("#paletteSwatches"),
  paletteMixPlans: document.querySelector("#paletteMixPlans"),
  paintForm: document.querySelector("#paintForm"),
  plannedPaintAmount: document.querySelector("#plannedPaintAmount"),
  paintConsumptionUnit: document.querySelector("#paintConsumptionUnit"),
  paintConsumptionStatus: document.querySelector("#paintConsumptionStatus"),
  paletteConsumptionBody: document.querySelector("#paletteConsumptionBody"),
  paintConsumptionBody: document.querySelector("#paintConsumptionBody"),
  paintManufacturer: document.querySelector("#paintManufacturer"),
  paintColorName: document.querySelector("#paintColorName"),
  paintPigmentCode: document.querySelector("#paintPigmentCode"),
  paintHex: document.querySelector("#paintHex"),
  paintHexText: document.querySelector("#paintHexText"),
  paintInventoryFeedback: document.querySelector("#paintInventoryFeedback"),
  paintInventory: document.querySelector("#paintInventory"),
  targetColor: document.querySelector("#targetColor"),
  pigmentA: document.querySelector("#pigmentA"),
  pigmentB: document.querySelector("#pigmentB"),
  partsA: document.querySelector("#partsA"),
  partsB: document.querySelector("#partsB"),
  mixPreview: document.querySelector("#mixPreview"),
  mixHex: document.querySelector("#mixHex"),
  mixRatio: document.querySelector("#mixRatio"),
  mixDifference: document.querySelector("#mixDifference"),
  saveRecipeButton: document.querySelector("#saveRecipeButton"),
  recipeFeedback: document.querySelector("#recipeFeedback"),
  starterRecipes: document.querySelector("#starterRecipes"),
  savedRecipes: document.querySelector("#savedRecipes"),
  clearImagesButton: document.querySelector("#clearImagesButton"),
};

function getRatioValue() {
  if (elements.ratioSelect.value === "free") {
    return null;
  }

  if (elements.ratioSelect.value === "custom") {
    const width = Number(elements.plannedWidthCm.value);
    const height = Number(elements.plannedHeightCm.value);
    return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? width / height
      : null;
  }

  const [width, height] = elements.ratioSelect.value.split(":").map(Number);
  return width / height;
}

function getGuideBounds(bounds, targetRatio = getRatioValue()) {
  if (!targetRatio) {
    return bounds;
  }

  const imageRatio = bounds.width / bounds.height;
  const frameWidth = targetRatio > imageRatio ? bounds.width : bounds.height * targetRatio;
  const frameHeight = targetRatio > imageRatio ? bounds.width / targetRatio : bounds.height;
  return {
    x: bounds.x + (bounds.width - frameWidth) / 2,
    y: bounds.y + (bounds.height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

function formatNumber(value, decimals = 1) {
  return Number(value.toFixed(decimals)).toString();
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function formatAspectRatio(width, height) {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function createImageSample(image, maxSide) {
  const scale = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("A böngésző nem tudta előkészíteni a képelemzést.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return { context, width, height };
}

function imageStateFor(slot) {
  return state[slot];
}

function setUploadError(message) {
  elements.uploadError.textContent = message;
  elements.uploadError.hidden = !message;
}

function analyzeImage(image) {
  const sampleSize = 72;
  const sample = createImageSample(image, sampleSize);
  const pixels = sample.context.getImageData(0, 0, sample.width, sample.height).data;
  const bins = [0, 0, 0, 0, 0];
  let luminanceSum = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
    luminanceSum += luminance;
    bins[Math.min(4, Math.floor(luminance / 51))] += 1;
  }

  return {
    mean: luminanceSum / (sample.width * sample.height),
    bins,
    sampleCount: sample.width * sample.height,
  };
}

function colorDistanceSquared(pixels, offset, center) {
  const red = pixels[offset] - center[0];
  const green = pixels[offset + 1] - center[1];
  const blue = pixels[offset + 2] - center[2];
  return red * red + green * green + blue * blue;
}

function nearestCenterIndex(pixels, offset, centers) {
  let nearest = 0;
  let nearestDistance = Infinity;

  for (let index = 0; index < centers.length; index += 1) {
    const distance = colorDistanceSquared(pixels, offset, centers[index]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  }
  return nearest;
}

function createNumberedPalette(image, requestedColors) {
  const sample = createImageSample(image, 480);
  const pixels = sample.context.getImageData(0, 0, sample.width, sample.height).data;
  const pixelCount = sample.width * sample.height;
  const sampleStride = Math.max(1, Math.floor(pixelCount / 60000));
  const sampleOffsets = [];
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += sampleStride) {
    const offset = pixel * 4;
    sampleOffsets.push(offset);
    redTotal += pixels[offset];
    greenTotal += pixels[offset + 1];
    blueTotal += pixels[offset + 2];
  }

  const centers = [[
    redTotal / sampleOffsets.length,
    greenTotal / sampleOffsets.length,
    blueTotal / sampleOffsets.length,
  ]];

  while (centers.length < requestedColors) {
    let farthestOffset = -1;
    let farthestDistance = -1;
    for (const offset of sampleOffsets) {
      let nearestDistance = Infinity;
      for (const center of centers) {
        nearestDistance = Math.min(nearestDistance, colorDistanceSquared(pixels, offset, center));
      }
      if (nearestDistance > farthestDistance) {
        farthestDistance = nearestDistance;
        farthestOffset = offset;
      }
    }

    if (farthestOffset < 0 || farthestDistance === 0) {
      break;
    }
    centers.push([
      pixels[farthestOffset],
      pixels[farthestOffset + 1],
      pixels[farthestOffset + 2],
    ]);
  }

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const redSums = new Float64Array(centers.length);
    const greenSums = new Float64Array(centers.length);
    const blueSums = new Float64Array(centers.length);
    const counts = new Uint32Array(centers.length);

    for (const offset of sampleOffsets) {
      const cluster = nearestCenterIndex(pixels, offset, centers);
      redSums[cluster] += pixels[offset];
      greenSums[cluster] += pixels[offset + 1];
      blueSums[cluster] += pixels[offset + 2];
      counts[cluster] += 1;
    }

    for (let cluster = 0; cluster < centers.length; cluster += 1) {
      if (counts[cluster] > 0) {
        centers[cluster] = [
          redSums[cluster] / counts[cluster],
          greenSums[cluster] / counts[cluster],
          blueSums[cluster] / counts[cluster],
        ];
      }
    }
  }

  const outputSample = createImageSample(image, 1000);
  const outputPixels = outputSample.context.getImageData(0, 0, outputSample.width, outputSample.height).data;
  const outputPixelCount = outputSample.width * outputSample.height;
  const initialCounts = new Uint32Array(centers.length);
  for (let pixel = 0; pixel < outputPixelCount; pixel += 1) {
    initialCounts[nearestCenterIndex(outputPixels, pixel * 4, centers)] += 1;
  }

  const orderedCenters = [...centers.keys()]
    .filter((index) => initialCounts[index] > 0)
    .sort((left, right) => initialCounts[right] - initialCounts[left])
    .map((index) => centers[index]);
  const labels = new Uint8Array(outputPixelCount);
  const counts = new Uint32Array(orderedCenters.length);

  for (let pixel = 0; pixel < outputPixelCount; pixel += 1) {
    const cluster = nearestCenterIndex(outputPixels, pixel * 4, orderedCenters);
    labels[pixel] = cluster;
    counts[cluster] += 1;
  }

  const palette = orderedCenters.map((center, index) => {
    const red = Math.round(center[0]);
    const green = Math.round(center[1]);
    const blue = Math.round(center[2]);
    return {
      hex: rgbToHex(red, green, blue),
      rgb: [red, green, blue],
      count: counts[index],
    };
  });

  return {
    width: outputSample.width,
    height: outputSample.height,
    labels,
    palette,
  };
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
}

function drawPlaceholder(context, width, height, title, prompt) {
  context.fillStyle = "#f4f0e7";
  context.fillRect(0, 0, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#718071";
  context.font = "500 32px Georgia, serif";
  context.fillText("＋", width / 2, height / 2 - 21);
  context.fillStyle = "#657064";
  context.font = "600 12px system-ui, sans-serif";
  context.fillText(title, width / 2, height / 2 + 11);
  context.fillStyle = "#929187";
  context.font = "10px system-ui, sans-serif";
  context.fillText(prompt, width / 2, height / 2 + 31);
}

const MAX_GRID_DIVISIONS = 100;

function readPositiveNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getGridSettings() {
  const mode = elements.gridSelect.value;
  const settings = {
    mode,
    widthCm: readPositiveNumber(elements.plannedWidthCm),
    heightCm: readPositiveNumber(elements.plannedHeightCm),
    columns: null,
    rows: null,
    cellCm: null,
    error: "",
  };
  const standardDivisions = {
    thirds: 3,
    quarters: 4,
    "6x6": 6,
    "8x8": 8,
    "10x10": 10,
  };

  if (standardDivisions[mode]) {
    settings.columns = standardDivisions[mode];
    settings.rows = standardDivisions[mode];
  } else if (mode === "custom") {
    const columns = Number(elements.gridColumns.value);
    const rows = Number(elements.gridRows.value);
    if (!Number.isInteger(columns) || columns < 1 || columns > MAX_GRID_DIVISIONS
      || !Number.isInteger(rows) || rows < 1 || rows > MAX_GRID_DIVISIONS) {
      settings.error = `Az oszlopok és sorok száma 1 és ${MAX_GRID_DIVISIONS} közötti egész szám legyen.`;
      return settings;
    }
    settings.columns = columns;
    settings.rows = rows;
  } else if (mode === "metric") {
    settings.cellCm = readPositiveNumber(elements.gridCellCm);
    if (!settings.widthCm || !settings.heightCm || !settings.cellCm) {
      settings.error = "A centiméteres négyzetrácshoz add meg a kép szélességét, magasságát és a rácsköz méretét.";
      return settings;
    }
    const columns = Math.ceil(settings.widthCm / settings.cellCm) - 1;
    const rows = Math.ceil(settings.heightCm / settings.cellCm) - 1;
    if (columns > MAX_GRID_DIVISIONS || rows > MAX_GRID_DIVISIONS) {
      settings.error = `A rács legfeljebb ${MAX_GRID_DIVISIONS} belső vonalat tartalmazhat irányonként; növeld a rácsköz méretét.`;
      return settings;
    }
  }

  return settings;
}

function drawGrid(context, bounds, settings) {
  if (settings.error || settings.mode === "none") {
    return;
  }

  context.save();
  context.beginPath();
  context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.clip();
  context.strokeStyle = "rgb(255 254 246 / 88%)";
  context.lineWidth = 1;
  context.shadowColor = "rgb(22 28 24 / 65%)";
  context.shadowBlur = 2;
  context.setLineDash([]);
  context.beginPath();

  if (settings.mode === "diagonals") {
    context.moveTo(bounds.x, bounds.y);
    context.lineTo(bounds.x + bounds.width, bounds.y + bounds.height);
    context.moveTo(bounds.x + bounds.width, bounds.y);
    context.lineTo(bounds.x, bounds.y + bounds.height);
    context.moveTo(bounds.x + bounds.width / 2, bounds.y);
    context.lineTo(bounds.x + bounds.width / 2, bounds.y + bounds.height);
    context.moveTo(bounds.x, bounds.y + bounds.height / 2);
    context.lineTo(bounds.x + bounds.width, bounds.y + bounds.height / 2);
  } else if (settings.mode === "metric") {
    const verticalLines = Math.ceil(settings.widthCm / settings.cellCm) - 1;
    const horizontalLines = Math.ceil(settings.heightCm / settings.cellCm) - 1;
    for (let line = 1; line <= verticalLines; line += 1) {
      const distance = line * settings.cellCm;
      const x = bounds.x + (bounds.width * distance) / settings.widthCm;
      context.moveTo(x, bounds.y);
      context.lineTo(x, bounds.y + bounds.height);
    }
    for (let line = 1; line <= horizontalLines; line += 1) {
      const distance = line * settings.cellCm;
      const y = bounds.y + (bounds.height * distance) / settings.heightCm;
      context.moveTo(bounds.x, y);
      context.lineTo(bounds.x + bounds.width, y);
    }
  } else {
    for (let division = 1; division < settings.columns; division += 1) {
      const x = bounds.x + (bounds.width * division) / settings.columns;
      context.moveTo(x, bounds.y);
      context.lineTo(x, bounds.y + bounds.height);
    }
    for (let division = 1; division < settings.rows; division += 1) {
      const y = bounds.y + (bounds.height * division) / settings.rows;
      context.moveTo(bounds.x, y);
      context.lineTo(bounds.x + bounds.width, y);
    }
  }
  context.stroke();
  context.restore();
}

function drawGuideMask(context, imageBounds, guideBounds) {
  if (imageBounds === guideBounds
    || (imageBounds.x === guideBounds.x && imageBounds.y === guideBounds.y
      && imageBounds.width === guideBounds.width && imageBounds.height === guideBounds.height)) {
    return;
  }

  context.save();
  context.fillStyle = "rgb(22 27 24 / 28%)";
  context.fillRect(imageBounds.x, imageBounds.y, imageBounds.width, guideBounds.y - imageBounds.y);
  context.fillRect(
    imageBounds.x,
    guideBounds.y + guideBounds.height,
    imageBounds.width,
    imageBounds.y + imageBounds.height - guideBounds.y - guideBounds.height,
  );
  context.fillRect(imageBounds.x, guideBounds.y, guideBounds.x - imageBounds.x, guideBounds.height);
  context.fillRect(
    guideBounds.x + guideBounds.width,
    guideBounds.y,
    imageBounds.x + imageBounds.width - guideBounds.x - guideBounds.width,
    guideBounds.height,
  );
  context.restore();
}

function drawGuideFrame(context, bounds) {
  context.save();
  context.strokeStyle = "rgb(255 255 247 / 92%)";
  context.lineWidth = 1;
  context.setLineDash([5, 4]);
  context.shadowColor = "rgb(22 28 24 / 65%)";
  context.shadowBlur = 2;
  context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, Math.max(0, bounds.width - 1), Math.max(0, bounds.height - 1));
  context.restore();
}

function drawCompositionGuideOverlay(context, imageBounds) {
  const guideBounds = getGuideBounds(imageBounds);
  drawGuideMask(context, imageBounds, guideBounds);
  drawGrid(context, guideBounds, getGridSettings());
  drawGuideFrame(context, guideBounds);
}

function drawSlot(slot) {
  const canvas = elements[`${slot}Canvas`];
  const context = canvas.getContext("2d");
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const imageData = imageStateFor(slot);
  if (!imageData) {
    drawPlaceholder(
      context,
      width,
      height,
      slot === "reference" ? "Referencia" : "Készülő kép",
      "A kép betöltése után itt jelenik meg",
    );
    return;
  }

  const scale = Math.min(width / imageData.image.naturalWidth, height / imageData.image.naturalHeight);
  const imageWidth = imageData.image.naturalWidth * scale;
  const imageHeight = imageData.image.naturalHeight * scale;
  const imageBounds = {
    x: (width - imageWidth) / 2,
    y: (height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  };

  context.fillStyle = "#eae5da";
  context.fillRect(0, 0, width, height);
  context.drawImage(imageData.image, imageBounds.x, imageBounds.y, imageWidth, imageHeight);

  drawCompositionGuideOverlay(context, imageBounds);
}

function updateGridSpacingSummary(settings = getGridSettings()) {
  const widthCm = settings.widthCm;
  const heightCm = settings.heightCm;
  if (elements.ratioSelect.value === "custom" && (!widthCm || !heightCm)) {
    elements.gridSpacingSummary.textContent = "Az egyéni képarányhoz add meg a tervezett szélességet és magasságot.";
    return;
  }
  if (settings.error) {
    elements.gridSpacingSummary.textContent = settings.error;
    return;
  }
  if (settings.mode === "none") {
    elements.gridSpacingSummary.textContent = "Nincs segédvonal-rács.";
    return;
  }
  if (settings.mode === "diagonals") {
    elements.gridSpacingSummary.textContent = "Átlós segédvonalak és középvonalak.";
    return;
  }
  if (settings.mode === "metric") {
    const verticalLines = Math.max(0, Math.ceil(widthCm / settings.cellCm) - 1);
    const horizontalLines = Math.max(0, Math.ceil(heightCm / settings.cellCm) - 1);
    elements.gridSpacingSummary.textContent = `${formatNumber(settings.cellCm)} cm-es négyzetrács · ${verticalLines} függőleges és ${horizontalLines} vízszintes belső vonal; a széleken maradhat rövidebb cella.`;
    return;
  }

  const gridName = settings.mode === "custom"
    ? `${settings.columns} oszlop × ${settings.rows} sor`
    : `${settings.columns} × ${settings.rows} rács`;
  if (!widthCm || !heightCm) {
    elements.gridSpacingSummary.textContent = `${gridName}. Add meg a tervezett kép méretét a vonalközök centiméteres kiszámításához.`;
    return;
  }

  const verticalSpacing = widthCm / settings.columns;
  const horizontalSpacing = heightCm / settings.rows;
  elements.gridSpacingSummary.textContent = `${gridName} · függőleges vonalköz: ${formatNumber(verticalSpacing, 2)} cm · vízszintes vonalköz: ${formatNumber(horizontalSpacing, 2)} cm.`;
}

function updateGuideSettings() {
  elements.customGridSettings.hidden = elements.gridSelect.value !== "custom";
  elements.metricGridSettings.hidden = elements.gridSelect.value !== "metric";
  updateGridSpacingSummary();
  renderAll();
  redrawPaletteOutputs();
}

function updateImageStatus(slot) {
  const imageData = imageStateFor(slot);
  const statusElement = elements[`${slot}FileStatus`];
  const hintElement = elements[`${slot}CanvasHint`];
  const ratioElement = elements[`${slot}Ratio`];

  if (!imageData) {
    statusElement.textContent = slot === "reference" ? "Még nincs referencia." : "Még nincs készülő kép.";
    hintElement.textContent = slot === "reference" ? "Tölts fel egy referencia képet az összehasonlításhoz." : "Tölts fel egy képet a készülő munkáról.";
    ratioElement.textContent = "—";
    return;
  }

  statusElement.textContent = `${imageData.file.name} · ${imageData.image.naturalWidth} × ${imageData.image.naturalHeight}`;
  hintElement.textContent = `${imageData.image.naturalWidth} × ${imageData.image.naturalHeight} px`;
  ratioElement.textContent = formatAspectRatio(imageData.image.naturalWidth, imageData.image.naturalHeight);
}

function updateAspectSummary() {
  const reference = state.reference;
  const artwork = state.artwork;
  const targetRatio = getRatioValue();
  const targetLabel = elements.ratioSelect.value === "custom" && targetRatio
    ? `${formatNumber(Number(elements.plannedWidthCm.value))} × ${formatNumber(Number(elements.plannedHeightCm.value))} cm`
    : elements.ratioSelect.value;
  let message = "";

  if (reference && artwork) {
    const referenceRatio = reference.image.naturalWidth / reference.image.naturalHeight;
    const artworkRatio = artwork.image.naturalWidth / artwork.image.naturalHeight;
    const difference = (Math.abs(referenceRatio - artworkRatio) / referenceRatio) * 100;
    message = `A két kép képaránya ${formatNumber(difference)}%-kal tér el egymástól.`;
    if (targetRatio) {
      const referenceDeviation = (Math.abs(referenceRatio - targetRatio) / targetRatio) * 100;
      const artworkDeviation = (Math.abs(artworkRatio - targetRatio) / targetRatio) * 100;
      message += ` A kiválasztott ${targetLabel} kerettől a referencia ${formatNumber(referenceDeviation)}%, a készülő kép ${formatNumber(artworkDeviation)}% eltérésre van.`;
    }
  } else if (reference || artwork) {
    const imageData = reference || artwork;
    const label = reference ? "A referencia" : "A készülő kép";
    message = `${label} képaránya ${formatNumber(imageData.image.naturalWidth / imageData.image.naturalHeight, 2)}.`;
    if (targetRatio) {
      const deviation = (Math.abs(imageData.image.naturalWidth / imageData.image.naturalHeight - targetRatio) / targetRatio) * 100;
      message += ` A kiválasztott ${targetLabel} kerettől való eltérés ${formatNumber(deviation)}%.`;
    }
  } else {
    message = "Tölts fel két képet a képarányok összevetéséhez.";
  }

  elements.aspectSummary.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "summary-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⌁";
  const text = document.createElement("span");
  text.textContent = message;
  elements.aspectSummary.append(icon, text);
}

function createToneCard(slot) {
  const imageData = imageStateFor(slot);
  const card = document.createElement("article");
  card.className = "tone-card";
  const heading = document.createElement("div");
  heading.className = "tone-card-heading";
  const title = document.createElement("h3");
  title.textContent = slot === "reference" ? "Referencia" : "Készülő kép";
  const mean = document.createElement("span");
  mean.className = "tone-mean";

  if (!imageData) {
    mean.textContent = "nincs kép";
    heading.append(title, mean);
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "A tónusprofilhoz tölts fel egy képet.";
    card.append(heading, message);
    return card;
  }

  mean.textContent = `átlag ${formatNumber((imageData.tone.mean / 255) * 100)} / 100`;
  const bars = document.createElement("div");
  bars.className = "tone-bars";

  imageData.tone.bins.forEach((count, index) => {
    const bin = document.createElement("div");
    bin.className = "tone-bin";
    const track = document.createElement("div");
    track.className = "tone-bar-track";
    const bar = document.createElement("div");
    bar.className = "tone-bar";
    bar.style.height = `${Math.max(3, (count / imageData.tone.sampleCount) * 100)}%`;
    bar.style.filter = `brightness(${0.56 + index * 0.17})`;
    track.append(bar);
    const label = document.createElement("span");
    label.className = "tone-bin-label";
    label.title = `${toneBinNames[index]} tónus`;
    label.textContent = toneBinNames[index];
    bin.append(track, label);
    bars.append(bin);
  });

  heading.append(title, mean);
  card.append(heading, bars);
  return card;
}

function updateToneComparison() {
  elements.toneComparison.replaceChildren();
  elements.toneComparison.append(createToneCard("reference"), createToneCard("artwork"));

  if (state.reference && state.artwork) {
    const difference = ((state.artwork.tone.mean - state.reference.tone.mean) / 255) * 100;
    const delta = document.createElement("p");
    delta.className = "tone-delta";
    if (Math.abs(difference) < 3) {
      delta.textContent = "A két kép átlagos tónusértéke közel azonos. Nézd meg az egyes tónustartományok eloszlását is.";
    } else {
      const direction = difference > 0 ? "világosabb" : "sötétebb";
      delta.textContent = `A készülő kép átlagos tónusa ${formatNumber(Math.abs(difference))} ponttal ${direction} a referenciánál. Ez az egész képre számított átlag; a helyi tónuskülönbségek is számítanak.`;
    }
    elements.toneComparison.append(delta);
  }
}

function getPaletteImage() {
  return imageStateFor(elements.paletteSource.value);
}

function findRegionAnchors(labels, width, height, paletteCount) {
  const visited = new Uint8Array(labels.length);
  const queue = new Int32Array(labels.length);
  const largestRegions = Array.from({ length: paletteCount }, () => null);

  for (let start = 0; start < labels.length; start += 1) {
    if (visited[start]) {
      continue;
    }

    const label = labels[start];
    let head = 0;
    let tail = 0;
    let xTotal = 0;
    let yTotal = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    while (head < tail) {
      const current = queue[head];
      head += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      xTotal += x;
      yTotal += y;

      if (x > 0 && !visited[current - 1] && labels[current - 1] === label) {
        visited[current - 1] = 1;
        queue[tail] = current - 1;
        tail += 1;
      }
      if (x + 1 < width && !visited[current + 1] && labels[current + 1] === label) {
        visited[current + 1] = 1;
        queue[tail] = current + 1;
        tail += 1;
      }
      if (y > 0 && !visited[current - width] && labels[current - width] === label) {
        visited[current - width] = 1;
        queue[tail] = current - width;
        tail += 1;
      }
      if (y + 1 < height && !visited[current + width] && labels[current + width] === label) {
        visited[current + width] = 1;
        queue[tail] = current + width;
        tail += 1;
      }
    }

    const region = {
      label,
      size: tail,
      x: xTotal / tail,
      y: yTotal / tail,
    };
    if (!largestRegions[label] || region.size > largestRegions[label].size) {
      largestRegions[label] = region;
    }
  }

  const anchors = largestRegions
    .filter(Boolean)
    .sort((left, right) => right.size - left.size);
  const placed = [];
  const minimumDistance = Math.max(24, Math.min(width, height) * 0.085);
  const minimumDistanceSquared = minimumDistance * minimumDistance;

  anchors.forEach((anchor) => {
    let bestPoint = { x: anchor.x, y: anchor.y };
    const distanceToPlaced = (x, y) => placed.reduce((minimum, other) => {
      const dx = x - other.x;
      const dy = y - other.y;
      return Math.min(minimum, dx * dx + dy * dy);
    }, Infinity);
    let bestDistance = distanceToPlaced(bestPoint.x, bestPoint.y);

    if (bestDistance < minimumDistanceSquared) {
      let foundSpace = false;
      const maxRadius = Math.max(width, height);
      for (let radius = minimumDistance; radius < maxRadius && !foundSpace; radius += minimumDistance / 2) {
        for (let direction = 0; direction < 24; direction += 1) {
          const angle = (direction / 24) * Math.PI * 2;
          const x = Math.round(anchor.x + Math.cos(angle) * radius);
          const y = Math.round(anchor.y + Math.sin(angle) * radius);
          if (x < 0 || x >= width || y < 0 || y >= height || labels[y * width + x] !== anchor.label) {
            continue;
          }
          const distance = distanceToPlaced(x, y);
          if (distance > bestDistance) {
            bestDistance = distance;
            bestPoint = { x, y };
          }
          if (distance >= minimumDistanceSquared) {
            foundSpace = true;
            break;
          }
        }
      }
    }

    const markerScale = bestDistance < minimumDistanceSquared
      ? Math.max(0.5, Math.sqrt(bestDistance) / minimumDistance)
      : 1;
    placed.push({ ...anchor, ...bestPoint, markerScale });
  });
  return placed.sort((left, right) => left.label - right.label);
}

function writeContourPixel(imageData, pixel, color) {
  const offset = pixel * 4;
  imageData.data[offset] = color[0];
  imageData.data[offset + 1] = color[1];
  imageData.data[offset + 2] = color[2];
  imageData.data[offset + 3] = 255;
}

function contourColorFor(rgb) {
  const luminance = (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
  return luminance > 132 ? [29, 42, 34] : [255, 255, 250];
}

function drawContourOverlay(context, map, targetLabel = null) {
  const overlay = document.createElement("canvas");
  overlay.width = map.width;
  overlay.height = map.height;
  const overlayContext = overlay.getContext("2d");
  const imageData = overlayContext.createImageData(map.width, map.height);
  const { labels, palette, width, height } = map;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const label = labels[pixel];
      if (targetLabel === null) {
        if (x + 1 < width && labels[pixel + 1] !== label) {
          writeContourPixel(imageData, pixel, contourColorFor(palette[label].rgb));
          writeContourPixel(imageData, pixel + 1, contourColorFor(palette[labels[pixel + 1]].rgb));
        }
        if (y + 1 < height && labels[pixel + width] !== label) {
          writeContourPixel(imageData, pixel, contourColorFor(palette[label].rgb));
          writeContourPixel(imageData, pixel + width, contourColorFor(palette[labels[pixel + width]].rgb));
        }
        continue;
      }

      const inRegion = label === targetLabel;
      const boundary = (x > 0 && (labels[pixel - 1] === targetLabel) !== inRegion)
        || (x + 1 < width && (labels[pixel + 1] === targetLabel) !== inRegion)
        || (y > 0 && (labels[pixel - width] === targetLabel) !== inRegion)
        || (y + 1 < height && (labels[pixel + width] === targetLabel) !== inRegion);
      if (boundary) {
        const color = inRegion ? contourColorFor(palette[targetLabel].rgb) : [31, 44, 36];
        writeContourPixel(imageData, pixel, color);
      }
    }
  }

  overlayContext.putImageData(imageData, 0, 0);
  context.drawImage(overlay, 0, 0);
}

function drawNumberedPaletteMap(map, highlightContours) {
  const canvas = elements.paletteMapCanvas;
  const context = canvas.getContext("2d");
  canvas.width = map.width;
  canvas.height = map.height;
  const raster = context.createImageData(map.width, map.height);

  for (let pixel = 0; pixel < map.labels.length; pixel += 1) {
    const color = map.palette[map.labels[pixel]].rgb;
    const offset = pixel * 4;
    raster.data[offset] = color[0];
    raster.data[offset + 1] = color[1];
    raster.data[offset + 2] = color[2];
    raster.data[offset + 3] = 255;
  }
  context.putImageData(raster, 0, 0);
  if (highlightContours) {
    drawContourOverlay(context, map);
  }
  drawCompositionGuideOverlay(context, { x: 0, y: 0, width: map.width, height: map.height });

  const anchors = findRegionAnchors(map.labels, map.width, map.height, map.palette.length);
  const baseFontSize = Math.max(12, Math.min(24, Math.round(Math.min(map.width, map.height) * 0.045)));
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  anchors.forEach((anchor) => {
    const fontSize = Math.max(9, Math.round(baseFontSize * anchor.markerScale));
    const radius = fontSize * 0.9;
    context.font = `600 ${fontSize}px system-ui, sans-serif`;
    context.beginPath();
    context.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
    context.fillStyle = "rgb(255 253 247 / 94%)";
    context.fill();
    context.lineWidth = Math.max(1.5, fontSize * 0.08);
    context.strokeStyle = "rgb(41 48 43 / 90%)";
    context.stroke();
    context.fillStyle = "#242a28";
    context.fillText(String(anchor.label + 1), anchor.x, anchor.y + 0.5);
  });
  context.restore();
}

function drawPaletteRegionMap(canvas, map, colorIndex, sourceImage, highlightContours) {
  const context = canvas.getContext("2d");
  canvas.width = map.width;
  canvas.height = map.height;
  context.drawImage(sourceImage, 0, 0, map.width, map.height);
  context.fillStyle = "rgb(255 253 247 / 78%)";
  context.fillRect(0, 0, map.width, map.height);

  const overlay = document.createElement("canvas");
  overlay.width = map.width;
  overlay.height = map.height;
  const overlayContext = overlay.getContext("2d");
  const raster = overlayContext.createImageData(map.width, map.height);
  const paletteColor = map.palette[colorIndex];
  const hatchColor = contourColorFor(paletteColor.rgb);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const pixel = y * map.width + x;
      if (map.labels[pixel] !== colorIndex) {
        continue;
      }

      const offset = pixel * 4;
      const isHatch = ((x + y) % 12) < 4;
      const color = isHatch ? hatchColor : paletteColor.rgb;
      raster.data[offset] = color[0];
      raster.data[offset + 1] = color[1];
      raster.data[offset + 2] = color[2];
      raster.data[offset + 3] = isHatch ? 238 : 78;
    }
  }
  overlayContext.putImageData(raster, 0, 0);
  context.drawImage(overlay, 0, 0);
  if (highlightContours) {
    drawContourOverlay(context, map, colorIndex);
  }
  drawCompositionGuideOverlay(context, { x: 0, y: 0, width: map.width, height: map.height });

  const fontSize = Math.max(14, Math.min(34, Math.round(Math.min(map.width, map.height) * 0.055)));
  const radius = fontSize;
  const inset = fontSize * 0.7;
  const centerX = map.width - inset - radius;
  const centerY = map.height - inset - radius;
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = "rgb(255 253 247 / 97%)";
  context.fill();
  context.lineWidth = Math.max(2, fontSize * 0.09);
  context.strokeStyle = "#26372d";
  context.stroke();
  context.fillStyle = "#26372d";
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(colorIndex + 1), centerX, centerY + 0.5);
  context.restore();
}

function clearPaletteDownloads() {
  state.paletteRenderId += 1;
  state.downloadUrls.forEach((url) => URL.revokeObjectURL(url));
  state.downloadUrls = [];
  return state.paletteRenderId;
}

function setPngDownload(canvas, link, filename, renderId) {
  link.hidden = false;
  link.textContent = "PNG készül…";
  link.removeAttribute("href");
  try {
    canvas.toBlob((blob) => {
      if (renderId !== state.paletteRenderId) {
        return;
      }
      if (!blob) {
        link.textContent = "PNG nem készíthető";
        link.setAttribute("aria-disabled", "true");
        console.error(`A(z) ${filename} PNG-kimenetét nem sikerült elkészíteni.`);
        return;
      }
      const url = URL.createObjectURL(blob);
      state.downloadUrls.push(url);
      link.href = url;
      link.download = filename;
      link.removeAttribute("aria-disabled");
      link.textContent = "PNG letöltése";
    }, "image/png");
  } catch (error) {
    console.error(`A(z) ${filename} PNG-kimenetét nem sikerült elkészíteni.`, error);
    link.textContent = "PNG nem készíthető";
    link.setAttribute("aria-disabled", "true");
  }
}

function renderSeparateColorMaps(map, renderId) {
  elements.paletteRegionMaps.replaceChildren();
  const source = imageStateFor(map.source);
  if (!source) {
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "A kiválasztott kép nem érhető el a külön térképekhez.";
    elements.paletteRegionMaps.append(message);
    return;
  }

  map.palette.forEach((entry, index) => {
    const card = document.createElement("article");
    card.className = "palette-region-card";
    const heading = document.createElement("div");
    heading.className = "palette-region-heading";
    const swatch = document.createElement("span");
    swatch.className = "region-color-swatch";
    swatch.style.backgroundColor = entry.hex;
    const title = document.createElement("span");
    title.textContent = "Kiemelt palettaterület";
    const code = document.createElement("span");
    code.className = "region-color-code";
    code.textContent = entry.hex.toUpperCase();
    heading.append(swatch, title, code);

    const frame = document.createElement("div");
    frame.className = "region-map-frame";
    const canvas = document.createElement("canvas");
    canvas.className = "region-map-canvas";
    canvas.setAttribute("aria-label", `${index + 1}. palettaszín területei sraffozással, a szám a jobb alsó sarokban`);
    drawPaletteRegionMap(canvas, map, index, source.image, elements.contourToggle.checked);
    frame.append(canvas);

    const actions = document.createElement("div");
    actions.className = "region-map-actions";
    const download = document.createElement("a");
    download.className = "download-button";
    download.download = `palettaszin-${String(index + 1).padStart(2, "0")}-${entry.hex.slice(1)}.png`;
    download.setAttribute("aria-label", `${index + 1}. palettaszín térképének letöltése PNG-ként`);
    actions.append(download);
    setPngDownload(canvas, download, download.download, renderId);
    card.append(heading, frame, actions);
    elements.paletteRegionMaps.append(card);
  });
}

function renderPaletteOutputs(map, renderId) {
  drawNumberedPaletteMap(map, elements.contourToggle.checked);
  setPngDownload(
    elements.paletteMapCanvas,
    elements.downloadPaletteMap,
    "szamozott-szinpaletta.png",
    renderId,
  );
  renderSeparateColorMaps(map, renderId);
}

function renderPaletteSwatches(map) {
  elements.paletteSwatches.replaceChildren();
  state.selectedSwatch = null;
  map.palette.forEach((entry, index) => {
    const button = document.createElement("button");
    button.className = "palette-swatch";
    button.type = "button";
    button.setAttribute("aria-label", `${index + 1}. szín, ${entry.hex}, beállítás keverési célként`);
    button.setAttribute("aria-pressed", "false");
    const swatch = document.createElement("span");
    swatch.className = "swatch-color";
    swatch.style.backgroundColor = entry.hex;
    const code = document.createElement("span");
    code.className = "swatch-code";
    code.textContent = `${index + 1}. · ${entry.hex.toUpperCase()}`;
    button.append(swatch, code);
    button.addEventListener("click", () => {
      state.selectedSwatch = index;
      elements.paletteSwatches.querySelectorAll(".palette-swatch").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      elements.targetColor.value = entry.hex;
      updateMix();
    });
    elements.paletteSwatches.append(button);
  });
}

function drawPaletteMapPlaceholder(message) {
  const context = elements.paletteMapCanvas.getContext("2d");
  elements.paletteMapCanvas.width = 480;
  elements.paletteMapCanvas.height = 240;
  drawPlaceholder(context, 480, 240, "Számozott palettatérkép", message);
}

function updatePalette() {
  const imageData = getPaletteImage();
  const renderId = clearPaletteDownloads();
  state.paletteMap = null;
  elements.paletteSwatches.replaceChildren();
  elements.paletteMixPlans.replaceChildren();
  elements.paletteRegionMaps.replaceChildren();
  elements.downloadPaletteMap.hidden = true;
  elements.downloadPaletteMap.removeAttribute("href");
  state.selectedSwatch = null;

  if (!imageData) {
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = elements.paletteSource.value === "reference"
      ? "Tölts fel egy referencia képet a számozott térképhez."
      : "Tölts fel egy képet a készülő munkáról a számozott térképhez.";
    elements.paletteSwatches.append(message);
    elements.paletteMixPlans.append(message.cloneNode(true));
    renderPaletteConsumption([]);
    renderPaintConsumption([]);
    const regionMessage = document.createElement("p");
    regionMessage.className = "empty-note";
    regionMessage.textContent = "A színenkénti térképek a palettatérkép elkészítése után jelennek meg.";
    elements.paletteRegionMaps.append(regionMessage);
    drawPaletteMapPlaceholder("A térkép képfeltöltés után készül el");
    elements.paletteMapStatus.textContent = message.textContent;
    return;
  }

  try {
    const palette = createNumberedPalette(imageData.image, Number(elements.paletteCount.value));
    state.paletteMap = {
      ...palette,
      source: elements.paletteSource.value,
    };
    renderPaletteSwatches(state.paletteMap);
    updatePaletteMixPlans();
    elements.paletteMapStatus.textContent = `${palette.palette.length} számozott színcsoport · ${palette.width} × ${palette.height} px-es térkép.`;
    renderPaletteOutputs(state.paletteMap, renderId);
  } catch (error) {
    console.error("A számozott palettatérkép elkészítése nem sikerült.", error);
    state.paletteMap = null;
    clearPaletteDownloads();
    elements.downloadPaletteMap.hidden = true;
    elements.downloadPaletteMap.removeAttribute("href");
    elements.paletteMixPlans.replaceChildren();
    elements.paletteRegionMaps.replaceChildren();
    elements.paletteMapStatus.textContent = "Nem sikerült elkészíteni a térképet. Próbálj meg kisebb vagy másik képet.";
    drawPaletteMapPlaceholder("A térképet nem sikerült elkészíteni");
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = elements.paletteMapStatus.textContent;
    elements.paletteSwatches.append(message);
    elements.paletteMixPlans.append(message.cloneNode(true));
    elements.paletteRegionMaps.append(message.cloneNode(true));
    renderPaletteConsumption([]);
    renderPaintConsumption([]);
  }
}

function redrawPaletteOutputs() {
  if (!state.paletteMap) {
    return;
  }

  const renderId = clearPaletteDownloads();
  renderPaletteOutputs(state.paletteMap, renderId);
}

function parseParts(input) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || value > 20) {
    return null;
  }
  return value;
}

function mixPigmentColors(colorA, colorB, partsA, partsB) {
  const totalParts = partsA + partsB;
  if (totalParts <= 0) {
    return null;
  }

  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  const mixChannel = (channel) => Math.round(
    ((rgbA[channel] * partsA) + (rgbB[channel] * partsB)) / totalParts,
  );
  return rgbToHex(mixChannel("red"), mixChannel("green"), mixChannel("blue"));
}

function paintDisplayName(paint) {
  return paint.manufacturer ? `${paint.manufacturer} · ${paint.name}` : paint.name;
}

function colorDifferencePercent(colorA, colorB) {
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  const distance = Math.sqrt(
    ((rgbA.red - rgbB.red) ** 2) +
    ((rgbA.green - rgbB.green) ** 2) +
    ((rgbA.blue - rgbB.blue) ** 2),
  );
  return Math.round((distance / Math.sqrt(3 * (255 ** 2))) * 100);
}

function findBestPaintMix(targetHex, inventory) {
  if (inventory.length === 0) {
    return null;
  }

  let best = null;
  const consider = (paintA, paintB, partsA, partsB, color) => {
    const difference = colorDifferencePercent(targetHex, color);
    if (!best || difference < best.difference) {
      best = { paintA, paintB, partsA, partsB, color, difference };
    }
  };

  inventory.forEach((paint) => consider(paint, null, 1, 0, paint.hex));
  for (let first = 0; first < inventory.length; first += 1) {
    for (let second = first + 1; second < inventory.length; second += 1) {
      const paintA = inventory[first];
      const paintB = inventory[second];
      const colorA = hexToRgb(paintA.hex);
      const colorB = hexToRgb(paintB.hex);
      const target = hexToRgb(targetHex);
      const redVector = colorA.red - colorB.red;
      const greenVector = colorA.green - colorB.green;
      const blueVector = colorA.blue - colorB.blue;
      const denominator = (redVector ** 2) + (greenVector ** 2) + (blueVector ** 2);
      if (denominator === 0) {
        continue;
      }

      const projection = (
        ((target.red - colorB.red) * redVector) +
        ((target.green - colorB.green) * greenVector) +
        ((target.blue - colorB.blue) * blueVector)
      ) / denominator;
      if (projection <= 0.02 || projection >= 0.98) {
        continue;
      }
      const partsA = projection * 10;
      const partsB = (1 - projection) * 10;
      const color = mixPigmentColors(paintA.hex, paintB.hex, partsA, partsB);
      consider(paintA, paintB, partsA, partsB, color);
    }
  }
  return best;
}

function getPaletteMixEstimates() {
  if (!state.paletteMap) {
    return [];
  }

  const mapArea = state.paletteMap.width * state.paletteMap.height;
  const totalAmount = Number(elements.plannedPaintAmount.value);
  const hasValidAmount = Number.isFinite(totalAmount) && totalAmount > 0;
  return state.paletteMap.palette.map((entry, index) => {
    const areaShare = entry.count / mapArea;
    return {
      entry,
      index,
      areaShare,
      amount: hasValidAmount ? totalAmount * areaShare : null,
      mix: state.paintInventory.length > 0
        ? findBestPaintMix(entry.hex, state.paintInventory)
        : null,
    };
  });
}

function renderConsumptionMessage(body, message) {
  body.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.className = "consumption-empty";
  cell.colSpan = 4;
  cell.textContent = message;
  row.append(cell);
  body.append(row);
}

function renderPaletteConsumption(estimates) {
  elements.paletteConsumptionBody.replaceChildren();
  if (!state.paletteMap) {
    renderConsumptionMessage(elements.paletteConsumptionBody, "Készíts palettatérképet.");
    return;
  }

  const unit = elements.paintConsumptionUnit.value;
  [...estimates]
    .sort((a, b) => (b.areaShare - a.areaShare) || (a.index - b.index))
    .forEach((estimate) => {
      const row = document.createElement("tr");
      const number = document.createElement("td");
      number.textContent = `#${estimate.index + 1}`;
      const colorCell = document.createElement("td");
      const color = document.createElement("span");
      color.className = "consumption-color";
      const swatch = document.createElement("span");
      swatch.className = "consumption-color-swatch";
      swatch.style.backgroundColor = estimate.entry.hex;
      const alias = document.createElement("span");
      alias.textContent = estimate.entry.hex.toUpperCase();
      color.append(swatch, alias);
      colorCell.append(color);
      const area = document.createElement("td");
      area.textContent = `${formatNumber(estimate.areaShare * 100, 2)}%`;
      const amount = document.createElement("td");
      amount.textContent = estimate.amount === null
        ? "—"
        : `${formatNumber(estimate.amount, 3)} ${unit}`;
      row.append(number, colorCell, area, amount);
      elements.paletteConsumptionBody.append(row);
    });
}

function renderPaintConsumption(estimates) {
  elements.paintConsumptionBody.replaceChildren();
  if (!state.paletteMap) {
    renderConsumptionMessage(elements.paintConsumptionBody, "Készíts palettatérképet.");
    elements.paintConsumptionStatus.textContent = "Készíts palettatérképet a fogyasztás becsléséhez.";
    return;
  }

  const totalAmount = Number(elements.plannedPaintAmount.value);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    renderConsumptionMessage(elements.paintConsumptionBody, "Adj meg pozitív teljes mennyiséget.");
    elements.paintConsumptionStatus.textContent = "Adj meg nullánál nagyobb teljes mennyiséget; a palettaszínek területi aránya ettől függetlenül látható.";
    return;
  }
  if (state.paintInventory.length === 0) {
    renderConsumptionMessage(elements.paintConsumptionBody, "Adj meg festékeket a saját készletedben.");
    elements.paintConsumptionStatus.textContent = `A paletta arányai ${formatNumber(totalAmount, 3)} ${elements.paintConsumptionUnit.value} teljes mennyiségre készültek; a festékigényhez rögzítsd a rendelkezésre álló festékeidet.`;
    return;
  }

  const paintNeeds = new Map();
  estimates.forEach((estimate) => {
    if (!estimate.mix || estimate.amount === null) {
      return;
    }

    const { mix } = estimate;
    const totalParts = mix.partsA + mix.partsB;
    if (totalParts <= 0) {
      return;
    }
    const amountA = estimate.amount * (mix.partsA / totalParts);
    paintNeeds.set(mix.paintA.id, (paintNeeds.get(mix.paintA.id) || 0) + amountA);
    if (mix.paintB) {
      const amountB = estimate.amount * (mix.partsB / totalParts);
      paintNeeds.set(mix.paintB.id, (paintNeeds.get(mix.paintB.id) || 0) + amountB);
    }
  });

  const sortedPaintNeeds = [...paintNeeds.entries()]
    .map(([id, amount]) => ({
      paint: state.paintInventory.find((paint) => paint.id === id),
      amount,
    }))
    .filter((need) => need.paint)
    .sort((a, b) => (b.amount - a.amount) || paintDisplayName(a.paint).localeCompare(paintDisplayName(b.paint)));

  if (sortedPaintNeeds.length === 0) {
    renderConsumptionMessage(elements.paintConsumptionBody, "A festékigény nem számítható ki a jelenlegi készletből.");
    elements.paintConsumptionStatus.textContent = "A festékigény nem számítható ki a jelenlegi készletből.";
    return;
  }

  const unit = elements.paintConsumptionUnit.value;
  sortedPaintNeeds.forEach(({ paint, amount }) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const color = document.createElement("span");
    color.className = "consumption-color";
    const swatch = document.createElement("span");
    swatch.className = "consumption-color-swatch";
    swatch.style.backgroundColor = paint.hex;
    const name = document.createElement("span");
    name.textContent = paintDisplayName(paint);
    color.append(swatch, name);
    nameCell.append(color);
    const code = document.createElement("td");
    code.textContent = paint.pigmentCode || "—";
    const quantity = document.createElement("td");
    quantity.textContent = `${formatNumber(amount, 3)} ${unit}`;
    const share = document.createElement("td");
    share.textContent = `${formatNumber((amount / totalAmount) * 100, 2)}%`;
    row.append(nameCell, code, quantity, share);
    elements.paintConsumptionBody.append(row);
  });

  elements.paintConsumptionStatus.textContent = `Becsült igény ${formatNumber(totalAmount, 3)} ${unit} teljes mennyiségre, a képfelület és a közelítő keverési arányok alapján.`;
}

function updatePaletteMixPlans() {
  elements.paletteMixPlans.replaceChildren();
  if (!state.paletteMap) {
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "Készíts palettatérképet a keverési tervekhez.";
    elements.paletteMixPlans.append(message);
    renderPaletteConsumption([]);
    renderPaintConsumption([]);
    return;
  }

  const estimates = getPaletteMixEstimates();
  if (state.paintInventory.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "Adj meg legalább egy saját olajfestéket; utána minden palettaszínhez megjelenik a legközelebbi keverési terv.";
    elements.paletteMixPlans.append(message);
  } else {
    estimates.forEach(({ entry, index, areaShare, mix }) => {
      if (!mix) {
        return;
      }

      const card = document.createElement("article");
      card.className = "palette-mix-plan";
      const swatch = document.createElement("span");
      swatch.className = "palette-plan-swatch";
      swatch.style.backgroundColor = entry.hex;
      swatch.textContent = String(index + 1);
      const content = document.createElement("div");
      content.className = "palette-plan-content";
      const heading = document.createElement("span");
      heading.className = "palette-plan-heading";
      heading.textContent = `${index + 1}. szín · ${entry.hex.toUpperCase()}`;
      const recipe = document.createElement("span");
      recipe.className = "palette-plan-recipe";
      recipe.textContent = mix.paintB
        ? `${paintDisplayName(mix.paintA)} ${formatNumber(mix.partsA)} : ${paintDisplayName(mix.paintB)} ${formatNumber(mix.partsB)} rész`
        : `${paintDisplayName(mix.paintA)} · önmagában`;
      recipe.title = recipe.textContent;
      const meta = document.createElement("span");
      meta.className = "palette-plan-meta";
      meta.textContent = `${formatNumber(areaShare * 100)}% terület · RGB-eltérés ${mix.difference}%`;
      content.append(heading, recipe, meta);
      card.append(swatch, content);
      elements.paletteMixPlans.append(card);
    });
  }

  renderPaletteConsumption(estimates);
  renderPaintConsumption(estimates);
}

function isValidInventoryEntry(value) {
  return value
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.manufacturer === "string"
    && typeof value.name === "string"
    && value.name.trim().length > 0
    && typeof value.pigmentCode === "string"
    && typeof value.hex === "string"
    && /^#[\da-f]{6}$/i.test(value.hex);
}

function updateInventoryFeedback(message, isError = false) {
  elements.paintInventoryFeedback.textContent = message;
  elements.paintInventoryFeedback.classList.toggle("error", isError);
}

function savePaintInventory() {
  try {
    window.localStorage.setItem("vonal-tonus-paint-inventory", JSON.stringify(state.paintInventory));
    return true;
  } catch (error) {
    console.error("A festékkészlet helyi mentése nem sikerült.", error);
    updateInventoryFeedback("A festékkészlet a munkamenetben elérhető, de a helyi mentése nem sikerült.", true);
    return false;
  }
}

function renderPaintInventory() {
  elements.paintInventory.replaceChildren();
  if (state.paintInventory.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "Még nincs megadott festék.";
    elements.paintInventory.append(message);
    updatePaletteMixPlans();
    return;
  }

  state.paintInventory.forEach((paint) => {
    const item = document.createElement("div");
    item.className = "paint-inventory-item";
    const swatch = document.createElement("span");
    swatch.className = "paint-inventory-swatch";
    swatch.style.backgroundColor = paint.hex;
    const details = document.createElement("div");
    details.className = "paint-inventory-details";
    const name = document.createElement("strong");
    name.textContent = paint.name;
    const metadata = document.createElement("span");
    metadata.textContent = [paint.manufacturer, paint.pigmentCode, paint.hex.toUpperCase()].filter(Boolean).join(" · ");
    const removeButton = document.createElement("button");
    removeButton.className = "remove-paint-button";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `${paintDisplayName(paint)} eltávolítása a festékkészletből`);
    removeButton.title = "Festék eltávolítása";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      state.paintInventory = state.paintInventory.filter((entry) => entry.id !== paint.id);
      const saved = savePaintInventory();
      renderPaintInventory();
      if (saved) {
        updateInventoryFeedback("A festék eltávolítva a készletből.");
      }
    });
    details.append(name, metadata);
    item.append(swatch, details, removeButton);
    elements.paintInventory.append(item);
  });
  updatePaletteMixPlans();
}

function loadPaintInventory() {
  try {
    const stored = window.localStorage.getItem("vonal-tonus-paint-inventory");
    if (!stored) {
      return;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      throw new Error("A mentett festékkészlet formátuma érvénytelen.");
    }
    state.paintInventory = parsed.filter(isValidInventoryEntry);
    if (state.paintInventory.length !== parsed.length) {
      console.warn("A mentett festékkészlet érvénytelen elemei kimaradtak.");
      updateInventoryFeedback("Néhány korábban mentett festék adata hibás volt, ezért nem került be a készletbe.", true);
    }
  } catch (error) {
    console.error("A mentett festékkészlet betöltése nem sikerült.", error);
    updateInventoryFeedback("A korábban mentett festékkészletet nem sikerült beolvasni.", true);
  }
}

function addPaintToInventory(event) {
  event.preventDefault();
  const name = elements.paintColorName.value.trim();
  if (!name) {
    updateInventoryFeedback("A festék színének elnevezése kötelező.", true);
    elements.paintColorName.focus();
    return;
  }

  const paint = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    manufacturer: elements.paintManufacturer.value.trim(),
    name,
    pigmentCode: elements.paintPigmentCode.value.trim(),
    hex: elements.paintHexText.value.trim().toLowerCase(),
  };
  if (!isValidInventoryEntry(paint)) {
    updateInventoryFeedback("Adj meg érvényes színmintát és színelnevezést.", true);
    return;
  }

  state.paintInventory.push(paint);
  const saved = savePaintInventory();
  renderPaintInventory();
  elements.paintManufacturer.value = "";
  elements.paintColorName.value = "";
  elements.paintPigmentCode.value = "";
  if (saved) {
    updateInventoryFeedback("A festék hozzáadva; a palettaszínek keverési terve frissült.");
  }
}

function updateMix() {
  const pigmentA = pigments.find((pigment) => pigment.id === elements.pigmentA.value);
  const pigmentB = pigments.find((pigment) => pigment.id === elements.pigmentB.value);
  const partsA = parseParts(elements.partsA);
  const partsB = parseParts(elements.partsB);

  if (!pigmentA || !pigmentB || partsA === null || partsB === null || partsA + partsB <= 0) {
    elements.mixDifference.textContent = "Adj meg 0-nál nagyobb, legfeljebb 20 részt.";
    elements.mixDifference.classList.add("error");
    elements.saveRecipeButton.disabled = true;
    return null;
  }

  const color = mixPigmentColors(pigmentA.hex, pigmentB.hex, partsA, partsB);
  const target = hexToRgb(elements.targetColor.value);
  const mixed = hexToRgb(color);
  const channelDistance = Math.sqrt(
    ((target.red - mixed.red) ** 2) +
    ((target.green - mixed.green) ** 2) +
    ((target.blue - mixed.blue) ** 2),
  );
  const difference = Math.round((channelDistance / Math.sqrt(3 * (255 ** 2))) * 100);

  elements.mixPreview.style.backgroundColor = color;
  elements.mixHex.textContent = color.toUpperCase();
  elements.mixRatio.textContent = `${formatNumber(partsA)} : ${formatNumber(partsB)} rész`;
  elements.mixDifference.textContent = `Képernyős RGB-eltérés a célszíntől: ${difference}%`;
  elements.mixDifference.classList.remove("error");
  elements.saveRecipeButton.disabled = false;
  return {
    pigmentA,
    pigmentB,
    partsA,
    partsB,
    color,
  };
}

function isValidRecipe(value) {
  return value
    && typeof value.pigmentA === "string"
    && pigments.some((pigment) => pigment.id === value.pigmentA)
    && typeof value.pigmentB === "string"
    && pigments.some((pigment) => pigment.id === value.pigmentB)
    && Number.isFinite(value.partsA)
    && value.partsA >= 0
    && Number.isFinite(value.partsB)
    && value.partsB >= 0
    && value.partsA + value.partsB > 0
    && typeof value.color === "string"
    && /^#[\da-f]{6}$/i.test(value.color)
    && typeof value.target === "string"
    && /^#[\da-f]{6}$/i.test(value.target);
}

function updateRecipeFeedback(message, isError = false) {
  elements.recipeFeedback.textContent = message;
  elements.recipeFeedback.classList.toggle("error", isError);
}

function renderRecipes() {
  elements.savedRecipes.replaceChildren();
  if (state.savedRecipes.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-note";
    message.textContent = "Még nincs mentett recept.";
    elements.savedRecipes.append(message);
    return;
  }

  state.savedRecipes.forEach((recipe, index) => {
    const pigmentA = pigments.find((pigment) => pigment.id === recipe.pigmentA);
    const pigmentB = pigments.find((pigment) => pigment.id === recipe.pigmentB);
    if (!pigmentA || !pigmentB) {
      return;
    }

    const button = document.createElement("button");
    button.className = "recipe-chip";
    button.type = "button";
    button.title = `${pigmentA.name} ${formatNumber(recipe.partsA)} rész + ${pigmentB.name} ${formatNumber(recipe.partsB)} rész`;
    const swatch = document.createElement("span");
    swatch.className = "recipe-chip-swatch";
    swatch.style.backgroundColor = recipe.color;
    const label = document.createElement("span");
    label.textContent = `Keverék ${index + 1} · ${formatNumber(recipe.partsA)}:${formatNumber(recipe.partsB)}`;
    button.append(swatch, label);
    button.addEventListener("click", () => {
      elements.pigmentA.value = recipe.pigmentA;
      elements.pigmentB.value = recipe.pigmentB;
      elements.partsA.value = String(recipe.partsA);
      elements.partsB.value = String(recipe.partsB);
      elements.targetColor.value = recipe.target;
      updateMix();
      updateRecipeFeedback("A mentett recept betöltve.");
    });
    elements.savedRecipes.append(button);
  });
}

function renderStarterRecipes() {
  elements.starterRecipes.replaceChildren();
  starterRecipes.forEach((recipe) => {
    const pigmentA = pigments.find((pigment) => pigment.id === recipe.pigmentA);
    const pigmentB = pigments.find((pigment) => pigment.id === recipe.pigmentB);
    const color = mixPigmentColors(pigmentA.hex, pigmentB.hex, recipe.partsA, recipe.partsB);
    const button = document.createElement("button");
    button.className = "starter-recipe-button";
    button.type = "button";
    button.title = `${recipe.label}: ${pigmentA.name} ${recipe.partsA} rész + ${pigmentB.name} ${recipe.partsB} rész`;
    button.setAttribute("aria-label", `${button.title} betöltése`);
    const swatch = document.createElement("span");
    swatch.className = "starter-recipe-swatch";
    swatch.style.backgroundColor = color;
    const label = document.createElement("span");
    label.textContent = `${recipe.label} · ${recipe.partsA}:${recipe.partsB}`;
    button.append(swatch, label);
    button.addEventListener("click", () => {
      elements.pigmentA.value = recipe.pigmentA;
      elements.pigmentB.value = recipe.pigmentB;
      elements.partsA.value = String(recipe.partsA);
      elements.partsB.value = String(recipe.partsB);
      updateMix();
      updateRecipeFeedback(`Betöltve: ${recipe.label}. Szükség szerint módosítsd az arányt, majd készíts próbafoltot.`);
    });
    elements.starterRecipes.append(button);
  });
}

function saveRecipe() {
  const mix = updateMix();
  if (!mix) {
    updateRecipeFeedback("Ellenőrizd a pigmenteket és a keverési arányokat.", true);
    return;
  }

  const recipe = {
    pigmentA: mix.pigmentA.id,
    pigmentB: mix.pigmentB.id,
    partsA: mix.partsA,
    partsB: mix.partsB,
    color: mix.color,
    target: elements.targetColor.value,
  };
  state.savedRecipes.unshift(recipe);
  state.savedRecipes = state.savedRecipes.slice(0, 12);
  renderRecipes();

  try {
    window.localStorage.setItem("vonal-tonus-recipes", JSON.stringify(state.savedRecipes));
    updateRecipeFeedback("A recept elmentve ezen az eszközön.");
  } catch (error) {
    console.error("A recept helyi mentése nem sikerült.", error);
    updateRecipeFeedback("A recept a munkamenetben elérhető, de a helyi mentése nem sikerült.", true);
  }
}

function loadSavedRecipes() {
  try {
    const stored = window.localStorage.getItem("vonal-tonus-recipes");
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      throw new Error("A mentett receptek formátuma érvénytelen.");
    }
    state.savedRecipes = parsed.filter(isValidRecipe).slice(0, 12);
  } catch (error) {
    console.error("A mentett receptek betöltése nem sikerült.", error);
    updateRecipeFeedback("A korábban mentett recepteket nem sikerült beolvasni.", true);
  }
}

function renderAll() {
  drawSlot("reference");
  drawSlot("artwork");
  updateAspectSummary();
}

function updateImagePanels() {
  updateImageStatus("reference");
  updateImageStatus("artwork");
  renderAll();
  updateToneComparison();
  updatePalette();
}

function loadImage(slot, file) {
  if (!file) {
    return;
  }
  if (file.type && !file.type.startsWith("image/")) {
    setUploadError("A kiválasztott fájl nem felismert képfájl. Válassz JPG, PNG, WebP vagy más képet.");
    return;
  }

  setUploadError("");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    try {
      const tone = analyzeImage(image);
      const previous = state[slot];
      if (previous) {
        URL.revokeObjectURL(previous.url);
      }
      state[slot] = { file, image, url, tone };
      updateImagePanels();
    } catch (error) {
      URL.revokeObjectURL(url);
      console.error("A kép feldolgozása nem sikerült.", error);
      setUploadError("A képet betöltöttük, de nem sikerült elemezni. Próbálj meg egy másik fájlt.");
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setUploadError("Nem sikerült megnyitni ezt a képet. Próbálj meg egy másik fájlt.");
  };
  image.src = url;
}

function clearImages() {
  ["reference", "artwork"].forEach((slot) => {
    if (state[slot]) {
      URL.revokeObjectURL(state[slot].url);
      state[slot] = null;
    }
  });
  elements.referenceInput.value = "";
  elements.artworkInput.value = "";
  setUploadError("");
  updateImagePanels();
}

function populatePigmentSelects() {
  [elements.pigmentA, elements.pigmentB].forEach((select) => {
    pigments.forEach((pigment) => {
      const option = document.createElement("option");
      option.value = pigment.id;
      option.textContent = pigment.name;
      select.append(option);
    });
  });
  elements.pigmentA.value = "yellow-ochre";
  elements.pigmentB.value = "burnt-sienna";
}

elements.referenceInput.addEventListener("change", (event) => loadImage("reference", event.target.files[0]));
elements.artworkInput.addEventListener("change", (event) => loadImage("artwork", event.target.files[0]));
elements.ratioSelect.addEventListener("change", updateGuideSettings);
elements.gridSelect.addEventListener("change", updateGuideSettings);
[elements.plannedWidthCm, elements.plannedHeightCm, elements.gridColumns, elements.gridRows, elements.gridCellCm]
  .forEach((input) => input.addEventListener("change", updateGuideSettings));
elements.paletteSource.addEventListener("change", updatePalette);
elements.paletteCount.addEventListener("change", updatePalette);
elements.extractPaletteButton.addEventListener("click", updatePalette);
elements.contourToggle.addEventListener("change", redrawPaletteOutputs);
elements.paintForm.addEventListener("submit", addPaintToInventory);
elements.plannedPaintAmount.addEventListener("input", updatePaletteMixPlans);
elements.paintConsumptionUnit.addEventListener("change", updatePaletteMixPlans);
elements.paintHex.addEventListener("input", () => {
  elements.paintHexText.value = elements.paintHex.value.toLowerCase();
});
elements.paintHexText.addEventListener("input", () => {
  if (/^#[\da-f]{6}$/i.test(elements.paintHexText.value)) {
    elements.paintHex.value = elements.paintHexText.value;
  }
});
elements.targetColor.addEventListener("input", updateMix);
elements.pigmentA.addEventListener("change", updateMix);
elements.pigmentB.addEventListener("change", updateMix);
elements.partsA.addEventListener("input", updateMix);
elements.partsB.addEventListener("input", updateMix);
elements.saveRecipeButton.addEventListener("click", saveRecipe);
elements.clearImagesButton.addEventListener("click", clearImages);
window.addEventListener("resize", renderAll);

if ("ResizeObserver" in window) {
  const observer = new ResizeObserver(renderAll);
  observer.observe(elements.referenceCanvas.parentElement);
  observer.observe(elements.artworkCanvas.parentElement);
}

populatePigmentSelects();
loadSavedRecipes();
loadPaintInventory();
renderRecipes();
updateGuideSettings();
renderStarterRecipes();
renderPaintInventory();
updateImagePanels();
updateMix();
