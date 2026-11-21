import { createId } from "../domain";
import type {
  AssetId,
  AssetRevision,
  ImageAnalysis,
  PaletteExtraction,
  PaletteSize,
} from "../domain";
import {
  workerProtocolVersion,
  workerResultSchemas,
  type WorkerErrorEvent,
  type WorkerEvent,
} from "./protocol";
import type { PaletteRegion } from "./palette";

export type AnalysisProgress = {
  stage: "decode" | "sample" | "analyze" | "quantize" | "map";
  completed: number;
  total: number;
};

export type ProcessingProgress = AnalysisProgress;

export type AnalysisTask = {
  requestId: string;
  result: Promise<ImageAnalysis>;
  cancel: () => void;
};

export type PaletteTask = {
  requestId: string;
  result: Promise<PaletteExtraction>;
  cancel: () => void;
};

export class ImageProcessingError extends Error {
  readonly code: WorkerErrorEvent["error"]["code"];
  readonly retryable: boolean;

  constructor(error: WorkerErrorEvent["error"]) {
    super(error.message);
    this.name = "ImageProcessingError";
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

type PendingRequest =
  | {
    operation: "image/analyze";
    resolve: (value: ImageAnalysis) => void;
    reject: (reason?: unknown) => void;
    onProgress?: (progress: AnalysisProgress) => void;
  }
  | {
    operation: "palette/extract";
    resolve: (value: PaletteExtraction) => void;
    reject: (reason?: unknown) => void;
    onProgress?: (progress: AnalysisProgress) => void;
  };

export class ImageProcessingClient {
  private readonly worker: Worker;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })) {
    this.worker = worker;
    this.worker.addEventListener("message", this.handleMessage);
  }

  analyze(
    asset: {
      assetId: AssetId;
      assetRevision: AssetRevision;
      source: Blob;
    },
    onProgress?: (progress: AnalysisProgress) => void,
  ): Promise<ImageAnalysis> {
    return this.startAnalysis(asset, onProgress).result;
  }

  startAnalysis(
    asset: {
      assetId: AssetId;
      assetRevision: AssetRevision;
      source: Blob;
    },
    onProgress?: (progress: AnalysisProgress) => void,
  ): AnalysisTask {
    const requestId = createId<"AnalysisId">();
    const result = new Promise<ImageAnalysis>((resolve, reject) => {
      this.pending.set(requestId, { operation: "image/analyze", resolve, reject, onProgress });
    });

    this.worker.postMessage({
      type: "image/analyze",
      protocolVersion: workerProtocolVersion,
      requestId,
      payload: {
        ...asset,
        toneBins: 5,
        sampleMaxSide: 72,
      },
    });
    return {
      requestId,
      result,
      cancel: () => this.cancel(requestId),
    };
  }

  startPaletteExtraction(
    asset: {
      assetId: AssetId;
      assetRevision: AssetRevision;
      source: Blob;
    },
    requestedColors: PaletteSize,
    activeRegion: PaletteRegion,
    activeAreaKey: string,
    onProgress?: (progress: AnalysisProgress) => void,
  ): PaletteTask {
    const requestId = createId<"AnalysisId">();
    const result = new Promise<PaletteExtraction>((resolve, reject) => {
      this.pending.set(requestId, {
        operation: "palette/extract",
        resolve,
        reject,
        onProgress,
      });
    });

    this.worker.postMessage({
      type: "palette/extract",
      protocolVersion: workerProtocolVersion,
      requestId,
      payload: {
        ...asset,
        requestedColors,
        sampleMaxSide: 1000,
        activeRegion,
        activeAreaKey,
      },
    });
    return {
      requestId,
      result,
      cancel: () => this.cancel(requestId),
    };
  }

  cancel(requestId: string) {
    this.worker.postMessage({
      type: "request/cancel",
      protocolVersion: workerProtocolVersion,
      requestId,
    });
  }

  dispose() {
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.terminate();
    this.pending.forEach(({ reject }) => reject(new Error("A képelemző Worker leállt.")));
    this.pending.clear();
  }

  private readonly handleMessage = (event: MessageEvent<WorkerEvent>) => {
    const message = event.data;
    const pending = this.pending.get(message.requestId);
    if (!pending) {
      return;
    }

    if (message.type === "progress") {
      pending.onProgress?.({
        stage: message.stage,
        completed: message.completed,
        total: message.total,
      });
      return;
    }

    this.pending.delete(message.requestId);
    if (message.type === "result") {
      if (message.operation !== pending.operation) {
        pending.reject(new Error("A képfeldolgozó Worker váratlan eredményt küldött."));
      } else if (message.operation === "palette/extract" && pending.operation === "palette/extract") {
        try {
          pending.resolve(workerResultSchemas["palette/extract"].parse(message).result);
        } catch {
          pending.reject(new Error("A palettakészítő Worker érvénytelen eredményt küldött."));
        }
      } else if (message.operation === "image/analyze" && pending.operation === "image/analyze") {
        try {
          const valid = workerResultSchemas["image/analyze"].parse(message);
          pending.resolve(valid.result);
        } catch {
          pending.reject(new Error("A képelemző Worker érvénytelen eredményt küldött."));
        }
      } else {
        pending.reject(new Error("A képfeldolgozó Worker eredménye nem egyezik a kéréssel."));
      }
    } else {
      pending.reject(new ImageProcessingError(message.error));
    }
  };
}
