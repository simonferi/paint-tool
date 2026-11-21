import { z } from "zod";
import {
  paletteExtractionSchema,
  paletteSizeSchema,
  type AssetId,
  type AssetRevision,
  type ImageAnalysis,
  type PaletteExtraction,
  type PaletteSize,
} from "../domain";
import { imageAnalysisSchema } from "../domain";
import type { PaletteRegion } from "./palette";

export const workerProtocolVersion = 2 as const;

const analyzePayloadSchema = z.object({
  assetId: z.string().min(1).transform((value) => value as AssetId),
  assetRevision: z.string().min(1).transform((value) => value as AssetRevision),
  source: z.custom<Blob>((value) => value instanceof Blob),
  toneBins: z.literal(5),
  sampleMaxSide: z.number().int().positive().max(4096),
});

const palettePayloadSchema = z.object({
  assetId: z.string().min(1).transform((value) => value as AssetId),
  assetRevision: z.string().min(1).transform((value) => value as AssetRevision),
  source: z.custom<Blob>((value) => value instanceof Blob),
  requestedColors: paletteSizeSchema,
  sampleMaxSide: z.number().int().positive().max(1000),
  activeRegion: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  activeAreaKey: z.string().min(1),
});

export const workerRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image/analyze"),
    protocolVersion: z.literal(workerProtocolVersion),
    requestId: z.string().min(1),
    payload: analyzePayloadSchema,
  }),
  z.object({
    type: z.literal("palette/extract"),
    protocolVersion: z.literal(workerProtocolVersion),
    requestId: z.string().min(1),
    payload: palettePayloadSchema,
  }),
  z.object({
    type: z.literal("request/cancel"),
    protocolVersion: z.literal(workerProtocolVersion),
    requestId: z.string().min(1),
  }),
]);

export type AnalyzeImageRequest = {
  type: "image/analyze";
  protocolVersion: typeof workerProtocolVersion;
  requestId: string;
  payload: {
    assetId: AssetId;
    assetRevision: AssetRevision;
    source: Blob;
    toneBins: 5;
    sampleMaxSide: number;
  };
};

export type ExtractPaletteRequest = {
  type: "palette/extract";
  protocolVersion: typeof workerProtocolVersion;
  requestId: string;
  payload: {
    assetId: AssetId;
    assetRevision: AssetRevision;
    source: Blob;
    requestedColors: PaletteSize;
    sampleMaxSide: number;
    activeRegion: PaletteRegion;
    activeAreaKey: string;
  };
};

export type WorkerRequest = AnalyzeImageRequest | {
  type: "request/cancel";
  protocolVersion: typeof workerProtocolVersion;
  requestId: string;
} | ExtractPaletteRequest;

export type WorkerProgressEvent = {
  type: "progress";
  requestId: string;
  stage: "decode" | "sample" | "analyze" | "quantize" | "map";
  completed: number;
  total: number;
};

export type WorkerResultEvent = {
  type: "result";
  requestId: string;
  operation: "image/analyze";
  result: ImageAnalysis;
} | {
  type: "result";
  requestId: string;
  operation: "palette/extract";
  result: PaletteExtraction;
};

export type WorkerErrorEvent = {
  type: "error";
  requestId: string;
  error: {
    code:
      | "INVALID_INPUT"
      | "UNSUPPORTED_IMAGE"
      | "DECODE_FAILED"
      | "OUT_OF_MEMORY"
      | "CANCELLED"
      | "PROCESSING_FAILED";
    message: string;
    retryable: boolean;
  };
};

export type WorkerEvent = WorkerProgressEvent | WorkerResultEvent | WorkerErrorEvent;

export const workerResultSchemas = {
  "image/analyze": z.object({
    type: z.literal("result"),
    requestId: z.string().min(1),
    operation: z.literal("image/analyze"),
    result: imageAnalysisSchema,
  }),
  "palette/extract": z.object({
    type: z.literal("result"),
    requestId: z.string().min(1),
    operation: z.literal("palette/extract"),
    result: paletteExtractionSchema,
  }),
} as const;
