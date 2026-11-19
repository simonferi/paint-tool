/// <reference lib="webworker" />

import { analyzeImageBlob } from "./analysis";
import { extractPaletteImageBlob } from "./palette";
import {
  workerRequestSchema,
  type WorkerEvent,
  type WorkerRequest,
} from "./protocol";

const cancelledRequests = new Set<string>();
const activeRequests = new Set<string>();
const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function post(event: WorkerEvent, transfer: Transferable[] = []) {
  workerScope.postMessage(event, transfer);
}

function errorCodeFor(error: unknown): "UNSUPPORTED_IMAGE" | "DECODE_FAILED" | "OUT_OF_MEMORY" | "PROCESSING_FAILED" {
  if (error instanceof DOMException && error.name === "EncodingError") {
    return "DECODE_FAILED";
  }
  if (error instanceof RangeError) {
    return "OUT_OF_MEMORY";
  }
  if (error instanceof Error && error.message.includes("nem támogatja")) {
    return "UNSUPPORTED_IMAGE";
  }
  return "PROCESSING_FAILED";
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const parsed = workerRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    post({
      type: "error",
      requestId: typeof event.data?.requestId === "string" ? event.data.requestId : "unknown",
      error: {
        code: "INVALID_INPUT",
        message: "A képelemző Worker érvénytelen kérést kapott.",
        retryable: false,
      },
    });
    return;
  }

  const request = parsed.data;
  if (request.type === "request/cancel") {
    if (activeRequests.has(request.requestId)) {
      cancelledRequests.add(request.requestId);
    }
    return;
  }

  activeRequests.add(request.requestId);
  try {
    if (cancelledRequests.has(request.requestId)) {
      throw new DOMException("A képfeldolgozás megszakadt.", "AbortError");
    }
    if (request.type === "palette/extract") {
      const result = await extractPaletteImageBlob(
        request.payload.source,
        {
          assetId: request.payload.assetId,
          assetRevision: request.payload.assetRevision,
          requestedColors: request.payload.requestedColors,
        },
        (stage, completed, total) => {
          if (cancelledRequests.has(request.requestId)) {
            throw new DOMException("A palettakészítés megszakadt.", "AbortError");
          }
          post({
            type: "progress",
            requestId: request.requestId,
            stage,
            completed,
            total,
          });
        },
      );
      if (cancelledRequests.has(request.requestId)) {
        throw new DOMException("A palettakészítés megszakadt.", "AbortError");
      }
      activeRequests.delete(request.requestId);
      cancelledRequests.delete(request.requestId);
      post(
        {
          type: "result",
          requestId: request.requestId,
          operation: "palette/extract",
          result,
        },
        [result.labelMap.buffer as ArrayBuffer, result.sourcePixels.buffer as ArrayBuffer],
      );
      return;
    }

    const result = await analyzeImageBlob(
      request.payload.source,
      {
        assetId: request.payload.assetId,
        assetRevision: request.payload.assetRevision,
      },
      request.payload.sampleMaxSide,
      (stage, completed, total) => {
        if (cancelledRequests.has(request.requestId)) {
          throw new DOMException("A képelemzés megszakadt.", "AbortError");
        }
        post({
          type: "progress",
          requestId: request.requestId,
          stage,
          completed,
          total,
        });
      },
    );

    activeRequests.delete(request.requestId);
    cancelledRequests.delete(request.requestId);
    post({
      type: "result",
      requestId: request.requestId,
      operation: "image/analyze",
      result,
    });
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    activeRequests.delete(request.requestId);
    cancelledRequests.delete(request.requestId);
    post({
      type: "error",
      requestId: request.requestId,
      error: {
        code: cancelled ? "CANCELLED" : errorCodeFor(error),
        message: cancelled
          ? "A képelemzés megszakadt."
          : error instanceof Error ? error.message : "A képelemzés nem sikerült.",
        retryable: !cancelled,
      },
    });
  }
};

export {};
